import { GoogleGenAI, Type } from "@google/genai";
import { JobRole, MarketInsight } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function fetchJobMarketData(): Promise<{ roles: JobRole[], insights: MarketInsight[] }> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: "Provide a list of 8 high-paying US job roles that specifically require both AI and Excel skills. For each, include the title, industry, salary range (e.g., '$120k - $180k'), average salary as a number, a brief description of how they use AI and Excel together, and 3 key skills. Also provide 3 general market insights about this skill combination.",
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          roles: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                industry: { type: Type.STRING },
                salaryRange: { type: Type.STRING },
                avgSalary: { type: Type.NUMBER },
                aiExcelUsage: { type: Type.STRING },
                keySkills: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              },
              required: ["title", "industry", "salaryRange", "avgSalary", "aiExcelUsage", "keySkills"]
            }
          },
          insights: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                trend: { type: Type.STRING },
                description: { type: Type.STRING }
              },
              required: ["trend", "description"]
            }
          }
        },
        required: ["roles", "insights"]
      }
    }
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    return { roles: [], insights: [] };
  }
}
