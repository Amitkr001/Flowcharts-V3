import fs from 'fs';
import readline from 'readline';

const rl = readline.createInterface({
  input: fs.createReadStream("C:/Users/amitk/.gemini/antigravity/brain/b3086bf0-d3d3-4b0a-b75d-08b1b6900512/.system_generated/logs/transcript_full.jsonl"),
  crlfDelay: Infinity
});

rl.on("line", (line) => {
  if (line.includes('"step_index":2838')) {
    const data = JSON.parse(line);
    const content = data.content;
    fs.writeFileSync("scratch/user_request_2838.txt", content, "utf8");
    console.log("Saved content, length:", content.length);
    rl.close();
    process.exit(0);
  }
});
