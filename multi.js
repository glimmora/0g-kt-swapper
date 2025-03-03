const { spawn } = require("child_process");
const fs = require("fs");
const dotenv = require("dotenv");

const ENV_PREFIX = ".env"; // Prefix for environment files
const SCRIPT_NAME = "main_swap.js"; // Your swap script
const MAX_CONCURRENT_TASKS = 10; // Max bots running at the same time
const MIN_DELAY = 15; // Minimum delay in seconds (adjustable)
const MAX_DELAY = 40; // Maximum delay in seconds (adjustable)
console.log("░▒▓█ＫＴ█▓▒░");

// Get all .env files
const envFiles = fs
  .readdirSync(".")
  .filter((file) => file.startsWith(ENV_PREFIX) && !isNaN(file.replace(ENV_PREFIX, "")))
  .sort((a, b) => parseInt(a.replace(ENV_PREFIX, ""), 10) - parseInt(b.replace(ENV_PREFIX, ""), 10));

console.log(`🔍 Found ${envFiles.length} .env files: ${envFiles.join(", ")}`);

let runningTasks = 0;
let index = 0;

async function startNextTask() {
  if (index >= envFiles.length) return;

  if (runningTasks < MAX_CONCURRENT_TASKS) {
    const envFile = envFiles[index++];
    console.log(`🚀 Starting bot with ${envFile}...`);

    const envConfig = dotenv.config({ path: envFile }).parsed;
    const loopCount = parseInt(envConfig.LOOP, 10) || 1;

    console.log(`🔄 ${envFile} will run ${loopCount} times`);

    for (let i = 0; i < loopCount; i++) {
      console.log(`▶️ Running ${envFile} (Iteration ${i + 1}/${loopCount})`);

      const child = spawn("node", [SCRIPT_NAME], { env: { ...process.env, DOTENV_CONFIG_PATH: envFile } });

      child.stdout.on("data", (data) => console.log(`[${envFile}] ${data}`));
      child.stderr.on("data", (data) => console.error(`[${envFile}] ERROR: ${data}`));

      await new Promise((resolve) => {
        child.on("exit", (code) => {
          console.log(`❌ Bot ${envFile} (Iteration ${i + 1}) exited with code ${code}`);
          resolve();
        });
      });

      // Random delay before the next loop (between MIN_DELAY and MAX_DELAY seconds)
      const delayTime = Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1) + MIN_DELAY) * 1000;
      console.log(`⏳ Waiting ${delayTime / 1000}s before next swap...`);
      await new Promise((resolve) => setTimeout(resolve, delayTime));
    }

    runningTasks--;
    startNextTask(); // Start another task if available
  }

  if (runningTasks < MAX_CONCURRENT_TASKS) {
    setTimeout(startNextTask, 5000); // Staggered starts for stability
  }
}

// Start execution
startNextTask();
