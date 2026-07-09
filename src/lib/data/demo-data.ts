import rawDemoData from "../../../seed/demo-data.json";
import { demoDataSchema, type DemoData } from "./schema";

export function parseDemoData(input: unknown): DemoData {
  return demoDataSchema.parse(input);
}

export const demoData: DemoData = parseDemoData(rawDemoData);
