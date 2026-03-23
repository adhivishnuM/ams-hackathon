/**
 * Vision Analysis Module (FRONTEND)
 * 
 * connect to Special NVIDIA Vision Backend
 */

export interface DiseaseAnalysis {
  disease_name: string;
  disease_name_hindi: string;
  disease_name_tamil?: string;
  disease_name_telugu?: string;
  disease_name_marathi?: string;
  confidence: number;
  severity: "low" | "medium" | "high";
  description: string;
  description_hindi: string;
  description_tamil?: string;
  description_telugu?: string;
  description_marathi?: string;
  symptoms: string[];
  symptoms_hindi: string[];
  symptoms_tamil?: string[];
  symptoms_telugu?: string[];
  symptoms_marathi?: string[];
  treatment_steps: string[];
  treatment_steps_hindi: string[];
  treatment_steps_tamil?: string[];
  treatment_steps_telugu?: string[];
  treatment_steps_marathi?: string[];
  organic_options: string[];
  organic_options_hindi: string[];
  organic_options_tamil?: string[];
  organic_options_telugu?: string[];
  organic_options_marathi?: string[];
  crop_identified?: string;
  crop_identified_hindi?: string;
  crop_identified_tamil?: string;
  crop_identified_telugu?: string;
  crop_identified_marathi?: string;
  prevention_tips: string[];
  prevention_tips_hindi: string[];
  prevention_tips_tamil?: string[];
  prevention_tips_telugu?: string[];
  prevention_tips_marathi?: string[];
  is_healthy?: boolean;
}

export interface VisionAnalysisResult {
  success: boolean;
  analysis?: DiseaseAnalysis;
  processed_image?: string;
  error?: string;
}

/**
 * Analyzes an image by sending it to the Python backend.
 */
export async function analyzeImage(imageFile: File, language: string = "en"): Promise<VisionAnalysisResult> {
  try {
    // Convert file to base64
    const base64Image = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(imageFile);
    });

    const BACKEND_URL = import.meta.env.VITE_API_URL || "https://ams-hackathon.onrender.com";
    const ENDPOINT = `${BACKEND_URL}/analyze-image/base64`;

    console.log(`🚀 Sending image to NVIDIA Specialty backend:`, ENDPOINT);

    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image: base64Image,
        language: language,
      })
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        success: false,
        error: `Backend error (${response.status}): ${text}`
      };
    }

    const data = await response.json();

    if (!data.success || !data.analysis) {
      return {
        success: false,
        error: "Invalid response from analysis server"
      };
    }

    return {
      success: true,
      analysis: data.analysis,
      processed_image: data.processed_image
    };

  } catch (error) {
    console.error("Frontend vision analysis error:", error);
    return {
      success: false,
      error: "Failed to connect to analysis server. Is the Python backend running?"
    };
  }
}
