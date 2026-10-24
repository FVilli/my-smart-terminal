import fs from "node:fs";
import OpenAI, { toFile } from "openai";
import path from "node:path";

const BASE = "https://unsloth.fvsg.mqu.it";
const KEY = process.env['UNSLOTH_API_KEY'] ?? "";


interface AudioModel extends OpenAI.Models.Model {
  audio_workflows?: string[];
}

if (KEY.trim().length === 0) {
  throw new Error("Set UNSLOTH_API_KEY before running this script.");
}

const client = new OpenAI({
  baseURL: `${BASE}/v1`,
  apiKey: KEY,
});

async function transcribe(filePath: string): Promise<string> {
  // 1. Recupera i modelli
  const response = await client.models.list();

  //console.log("Modelli disponibili:", response.data);

  // 2. Filtra quelli che supportano la trascrizione
  const models = (response.data as AudioModel[]).filter(
    (model) => model.audio_workflows?.includes("transcribe")
  );

  console.log("Modelli audio disponibili:");
  models.forEach((model, index) => {
    console.log(`${index + 1}. ${model.id}`);
  });

  // 3. Seleziona il primo
  const model = models[0];

  if (!model) {
    throw new Error("Nessun modello di trascrizione disponibile");
  }

  console.log(`\nModello selezionato: ${model.id}`);

  // 4. Trascrivi il file
  const result = await client.audio.transcriptions.create({
    model: model.id,
    file: await toFile(fs.readFileSync(filePath), path.basename(filePath)),
    response_format: "verbose_json",
    language: "en",
  });

  return result.text;
}

async function main(): Promise<void> {
  const input = process.argv[2] ?? fs.readdirSync("audio").find((name) => /\.(webm|wav|mp3|ogg|m4a|flac)$/i.test(name));
  if (input === undefined) throw new Error("No audio file found in ./audio");
  const filePath = fs.existsSync(input) ? input : path.join("audio", input);
  const text = await transcribe(filePath);
  console.log("\nTrascrizione:\n", text);
}

main().catch(console.error);