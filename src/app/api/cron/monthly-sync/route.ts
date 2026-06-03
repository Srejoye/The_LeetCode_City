import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const HF_TOKEN = process.env.HF_WRITE_TOKEN;
const DATASET_REPO = "Ixotic/coding-problems"; // Your HF Repo

export async function GET(request: Request) {
  // 1. Verify Authorization (Vercel Cron Secret)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (!HF_TOKEN) {
    return NextResponse.json({ error: "Missing HF_WRITE_TOKEN" }, { status: 500 });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });

  try {
    // 2. Fetch the entire dataset from Hugging Face
    console.log("Downloading dataset from Hugging Face...");
    const hfRes = await fetch(`https://huggingface.co/datasets/${DATASET_REPO}/resolve/main/data.jsonl`, {
      headers: { Authorization: `Bearer ${HF_TOKEN}` }
    });
    
    if (!hfRes.ok) {
      throw new Error(`Failed to fetch HF dataset: ${hfRes.statusText}`);
    }

    const textData = await hfRes.text();
    
    // 3. Parse JSONL
    const allProblems = textData.split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => JSON.parse(line));

    // 4. Find Unseeded Problems
    const unseeded = allProblems.filter(p => p.seeded === false);
    
    const unseededEasy = unseeded.filter(p => p.difficulty === 'easy');
    const unseededMedium = unseeded.filter(p => p.difficulty === 'medium');
    const unseededHard = unseeded.filter(p => p.difficulty === 'hard');

    console.log(`Unseeded available -> Easy: ${unseededEasy.length}, Medium: ${unseededMedium.length}, Hard: ${unseededHard.length}`);

    // We need 21 of each for the month
    const TARGET = 21;
    if (unseededEasy.length < TARGET || unseededMedium.length < TARGET || unseededHard.length < TARGET) {
      return NextResponse.json({ error: "Not enough unseeded problems remaining in HF dataset." }, { status: 400 });
    }

    // Pick the problems
    const selectedEasy = unseededEasy.slice(0, TARGET);
    const selectedMedium = unseededMedium.slice(0, TARGET);
    const selectedHard = unseededHard.slice(0, TARGET);
    
    const selectedAll = [...selectedEasy, ...selectedMedium, ...selectedHard];
    const selectedIds = new Set(selectedAll.map(p => p.source_id));

    // 5. Transform for Supabase schema
    const formattedForSupabase = selectedAll.map(p => ({
      source_id: String(p.source_id),
      title: p.title,
      description: p.description,
      difficulty: p.difficulty,
      tags: p.tags,
      examples: p.examples,
      input_format: p.input_format,
      output_format: p.output_format,
      hints: []
    }));

    // 6. Delete old problems from Supabase & Insert new ones
    console.log("Emptying old problems from Supabase...");
    const { error: delErr } = await sb.from("arena_problems").delete().neq("id", "00000000-0000-0000-0000-000000000000"); // deletes all
    if (delErr) throw delErr;

    console.log(`Inserting ${formattedForSupabase.length} new problems to Supabase...`);
    const { error: insErr } = await sb.from("arena_problems").insert(formattedForSupabase);
    if (insErr) throw insErr;

    // 7. Update HF Dataset state in memory (mark seeded: true)
    console.log("Updating HF dataset state...");
    const updatedProblemsText = allProblems.map(p => {
      if (selectedIds.has(p.source_id)) {
        return JSON.stringify({ ...p, seeded: true });
      }
      return JSON.stringify(p);
    }).join('\n');

    // 8. Re-upload back to Hugging Face
    // Note: Since Vercel Edge functions can't run the @huggingface/hub node module easily due to fs/path dependencies, 
    // we use the raw HF Hub REST API to commit the file.
    const commitBody = {
      operations: [
        {
          keypath: "data.jsonl",
          edit: {
            content: updatedProblemsText
          }
        }
      ],
      commit_message: "Monthly Cron: Seeded 63 new problems",
    };

    const commitRes = await fetch(`https://huggingface.co/api/datasets/${DATASET_REPO}/commit/main`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(commitBody)
    });

    if (!commitRes.ok) {
      throw new Error(`Failed to commit back to HF: ${await commitRes.text()}`);
    }

    return NextResponse.json({ success: true, message: `Successfully rotated ${formattedForSupabase.length} problems for the month.` });

  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
