import { startBot } from "./discord";
import * as dotenv from "dotenv";

dotenv.config();

console.log("ai-maid initializing...");

// Start the Discord bot
startBot();
