import { GoogleGenAI, Type } from "@google/genai";
import { Activity } from "../types";

// Initialize Gemini Client
// Note: In a production app, keys should be handled via backend proxies.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateActivityIdeas = async (
  topic: string, 
  count: number, 
  existingIdOffset: number
): Promise<Activity[]> => {
  
  const modelId = "gemini-2.5-flash";
  
  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: `Generiere ${count} kreative und realistische Schulaktivitäten oder Projektwochen-Themen für das Thema: "${topic}". 
      Erfinde fiktive aber realistische Namen für Lehrpersonen (Leitung).
      Setze die maximale Teilnehmerzahl zwischen 10 und 25.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Titel der Aktivität" },
              leader: { type: Type.STRING, description: "Name der leitenden Person" },
              maxParticipants: { type: Type.INTEGER, description: "Maximale Anzahl Schüler" },
              description: { type: Type.STRING, description: "Kurze Beschreibung (max 1 Satz)" }
            },
            required: ["name", "leader", "maxParticipants", "description"]
          }
        }
      }
    });

    const generatedData = JSON.parse(response.text || "[]");

    // Map to our Activity interface, adding IDs manually starting from offset
    return generatedData.map((item: any, index: number) => ({
      id: existingIdOffset + index + 1,
      name: item.name,
      leader: item.leader,
      maxParticipants: item.maxParticipants,
      description: item.description
    }));

  } catch (error) {
    console.error("Fehler bei der Generierung von Aktivitäten:", error);
    throw new Error("Konnte keine Aktivitäten generieren. Bitte überprüfen Sie Ihren API-Key oder versuchen Sie es später erneut.");
  }
};
