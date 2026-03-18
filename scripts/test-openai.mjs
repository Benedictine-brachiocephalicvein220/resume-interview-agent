import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 120000,
  maxRetries: 0,
});

async function main() {
  try {
    const models = await client.models.list();
    console.log("OK: models.list succeeded");
    console.log(models.data.slice(0, 5).map(m => m.id));
  } catch (err) {
    console.error("models.list failed:");
    console.error(err);
  }
}

main();