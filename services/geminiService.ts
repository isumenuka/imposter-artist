import { GoogleGenAI, Type } from "@google/genai";
import { Player, Role, Layer } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const generateAiWord = async (): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: "Generate a single common noun that is easy to draw (e.g., apple, cat, house, tree). Output ONLY the word, nothing else. No numbers, no spaces.",
    });
    return response.text.trim().toLowerCase();
  } catch (error) {
    console.error("Error generating word:", error);
    return "tree"; // Fallback
  }
};

export const generateAiDrawing = async (
    word: string, 
    isImposter: boolean, 
    round: number,
    color: string, // Hex color
    previousLayers: Layer[]
): Promise<string | null> => {
  try {
    let prompt = "";
    
    // Convert hex to a simple color name for the prompt
    // Using descriptive names to ensure high visibility on white background
    const colorMap: Record<string, string> = {
        '#ef4444': 'bright red',
        '#3b82f6': 'dark blue',
        '#22c55e': 'dark green',
        '#eab308': 'dark gold'
    };
    
    const colorName = colorMap[color] || 'black';

    if (isImposter) {
         prompt = `Draw a single, simple, abstract ${colorName} line stroke on a white background. It should look like a random squiggle made with a ${colorName} marker. Minimalist. Do not fill the page. Just one or two lines. Do not use any other colors.`;
    } else {
        // Collaborative prompt
        prompt = `Draw a SINGLE PART or STROKE of a ${word} on a white background using a ${colorName} marker. Do NOT draw the entire ${word}. Draw only a simple curve, line, or shape that is PART of the object. The style should be simple ${colorName} line art. Do not include text. Do not use any other colors.`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
      config: {
        // Match 800x600 canvas
        imageConfig: { aspectRatio: "4:3" }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Error generating drawing:", error);
    return null;
  }
};

export const generateAiChat = async (
  player: Player,
  allPlayers: Player[],
  layers: Layer[],
  word: string | null,
  gameLog: string[]
): Promise<string> => {
  try {
    const knownWord = player.role === Role.IMPOSTER ? "UNKNOWN" : word;
    
    const context = `
      You are playing a collaborative drawing game called Imposter Artist.
      Roles: Artists (know word), Imposter (doesn't know word).
      Everyone draws on the SAME canvas in their own color.
      
      Your Name: ${player.name}
      Your Role: ${player.role}
      The Word: ${knownWord}
      
      Game Context:
      ${gameLog.join('\n')}
      
      Instructions:
      - Write a short chat message (1 sentence).
      - If you are Imposter: Try to blend in. Mention the colors or lines.
      - If you are Artist: Comment on how the drawing is coming together.
      - Be casual.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: context,
      config: {
        maxOutputTokens: 50,
      }
    });
    
    return response.text.trim();
  } catch (error) {
    return "Thinking...";
  }
};

export const generateAiVote = async (
    player: Player,
    otherPlayers: Player[],
    gameLog: string[]
): Promise<string> => {
    try {
        const context = `
          You are ${player.name} (${player.role}).
          Vote for who you think is the Imposter.
          
          Candidates:
          ${otherPlayers.map(p => `- ${p.name} (ID: ${p.id})`).join('\n')}
          
          Game Log:
          ${gameLog.slice(-10).join('\n')}
          
          Return ONLY the ID of the player you want to vote for.
        `;
    
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: context,
        });
        
        const votedNameOrId = response.text.trim();
        const target = otherPlayers.find(p => votedNameOrId.includes(p.id) || votedNameOrId.includes(p.name));
        return target ? target.id : otherPlayers[0].id;

    } catch (e) {
        return otherPlayers[0].id;
    }
}

export const generateImposterGuess = async (
    layers: Layer[]
): Promise<string> => {
    try {
        const parts: any[] = [{ text: "Look at this composite line drawing. Guess what object is being depicted. Return ONLY the single word guess." }];
        
        const validLayer = layers[layers.length - 1];
        
        if (validLayer) {
            const base64Data = validLayer.imageUrl.split(',')[1];
            if (base64Data) {
                parts.push({
                    inlineData: {
                        mimeType: 'image/png',
                        data: base64Data
                    }
                });
            }
        }

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: { parts },
        });

        return response.text.trim().toLowerCase().replace(/[^\w\s]/gi, '');
    } catch (e) {
        return "apple";
    }
}
