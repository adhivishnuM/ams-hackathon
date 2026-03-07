/**
 * Agricultural Inference Module
 * 
 * Converts vision labels from image classification into
 * structured agricultural advice using rule-based pattern matching.
 */
// VisionLabel type for agricultural inference
export interface VisionLabel {
  label: string;
  score: number;
}

export interface AgriculturalAdvisory {
    condition: string;
    confidence: "Low" | "Medium" | "High";
    recommendation: string;
}

// Pattern definitions for agricultural conditions
interface ConditionPattern {
    keywords: string[];
    condition: string;
    recommendation: string;
}

const CONDITION_PATTERNS: ConditionPattern[] = [
    {
        keywords: ["yellow", "yellowing", "chlorosis", "pale", "faded", "bleach"],
        condition: "Possible Nutrient Deficiency",
        recommendation: "The yellowing pattern suggests possible nitrogen or iron deficiency. Consider soil testing and apply appropriate fertilizer. Ensure proper watering schedule - neither too much nor too little. If yellowing spreads, consult a local agricultural extension office."
    },
    {
        keywords: ["dry", "dried", "wilt", "wilted", "wilting", "drought", "parched", "crisp"],
        condition: "Water Stress Detected",
        recommendation: "Signs of water stress observed. Increase irrigation frequency, preferably early morning or evening. Consider mulching to retain soil moisture. Check for root damage that may prevent water uptake. Avoid watering during peak heat hours."
    },
    {
        keywords: ["brown", "browning", "necrosis", "dead", "dying", "scorched", "burnt"],
        condition: "Leaf Damage / Environmental Stress",
        recommendation: "Brown patches may indicate sunburn, frost damage, or chemical burn. If localized, prune affected areas. Ensure proper spacing for air circulation. Avoid pesticide application during hot days. Monitor for pest activity that may cause similar symptoms."
    },
    {
        keywords: ["spot", "spots", "spotted", "lesion", "lesions", "blotch", "patch"],
        condition: "Possible Fungal Infection",
        recommendation: "Spotted patterns suggest fungal or bacterial infection. Remove and destroy affected leaves to prevent spread. Apply appropriate fungicide (copper-based for organic farming). Improve air circulation and avoid overhead watering. Water at the base of plants."
    },
    {
        keywords: ["rust", "rusty", "orange", "reddish"],
        condition: "Rust Disease Suspected",
        recommendation: "Orange-rust coloring indicates possible rust fungus. Apply sulfur-based or approved fungicide immediately. Remove heavily infected leaves. Ensure good air circulation between plants. Avoid wetting leaves during irrigation."
    },
    {
        keywords: ["mold", "mildew", "fungus", "fungi", "powdery", "fuzzy", "cottony"],
        condition: "Mold/Mildew Infection",
        recommendation: "Fungal growth detected. Apply neem oil or appropriate fungicide. Reduce humidity around plants if possible. Ensure adequate plant spacing. Remove severely affected plant parts. Consider preventive treatments for nearby healthy plants."
    },
    {
        keywords: ["blight", "rot", "rotting", "decay", "decaying"],
        condition: "Blight or Rot Disease",
        recommendation: "Signs of blight or rot disease require immediate attention. Remove and destroy all infected plant material. Apply copper-based fungicide to remaining plants. Improve drainage to prevent waterlogging. Rotate crops in future seasons."
    },
    {
        keywords: ["insect", "bug", "pest", "aphid", "beetle", "caterpillar", "worm", "larvae", "mite"],
        condition: "Pest Infestation",
        recommendation: "Pest presence detected. Inspect plants thoroughly for eggs and larvae. Consider introducing beneficial insects like ladybugs. Use neem oil spray as an organic control measure. For severe infestations, apply appropriate insecticide following label instructions."
    },
    {
        keywords: ["hole", "holes", "eaten", "chewed", "damaged", "bite"],
        condition: "Insect Feeding Damage",
        recommendation: "Feeding damage from insects observed. Inspect undersides of leaves for pests. Apply organic pest deterrents like neem oil. Consider physical barriers or traps. Remove heavily damaged leaves. Monitor daily for pest activity."
    },
    {
        keywords: ["healthy", "green", "fresh", "vibrant", "lush", "thriving"],
        condition: "Healthy Plant",
        recommendation: "Your crop appears healthy! Continue current care practices. Maintain consistent watering schedule. Monitor regularly for early signs of stress. Consider preventive organic treatments. Ensure adequate nutrition through compost or balanced fertilizer."
    },
    {
        keywords: ["leaf", "leaves", "foliage", "plant", "vegetation", "grass", "tree", "flower"],
        condition: "General Plant Identified",
        recommendation: "Plant foliage detected. For specific disease diagnosis, ensure the image clearly shows any problem areas. Take close-up photos of affected leaves. Good lighting helps accurate analysis. If you suspect issues, compare with healthy parts of the same plant."
    }
];

// Fallback advisory when analysis fails or no patterns match
export const FALLBACK_ADVISORY: AgriculturalAdvisory = {
    condition: "Analysis Unavailable",
    confidence: "Low",
    recommendation: "Unable to analyze the image at this time. For best results, ensure good lighting and a clear view of the plant. Take close-up photos of any problem areas. You can try again or consult a local agricultural expert for in-person diagnosis."
};

/**
 * Converts vision labels to agricultural advisory using rule-based inference.
 * 
 * @param labels - Array of vision labels from image classification
 * @returns Structured agricultural advisory
 */
export function inferAgriculturalAdvice(labels: VisionLabel[]): AgriculturalAdvisory {
    if (!labels || labels.length === 0) {
        return {
            ...FALLBACK_ADVISORY,
            condition: "Unable to Identify",
            recommendation: "Could not identify plant features in the image. Please upload a clearer photo with good lighting, focusing on leaves or affected plant parts."
        };
    }

    // Combine all labels into a searchable string
    const labelText = labels.map(l => l.label.toLowerCase()).join(" ");

    // Calculate the maximum confidence score from top labels
    const maxScore = Math.max(...labels.slice(0, 3).map(l => l.score));

    // Find matching condition patterns
    let bestMatch: ConditionPattern | null = null;
    let bestMatchScore = 0;

    for (const pattern of CONDITION_PATTERNS) {
        let matchCount = 0;
        for (const keyword of pattern.keywords) {
            if (labelText.includes(keyword)) {
                matchCount++;
            }
        }

        if (matchCount > bestMatchScore) {
            bestMatchScore = matchCount;
            bestMatch = pattern;
        }
    }

    // Determine confidence level based on match quality and vision scores
    let confidence: "Low" | "Medium" | "High";
    if (maxScore >= 0.5 && bestMatchScore >= 2) {
        confidence = "High";
    } else if (maxScore >= 0.2 || bestMatchScore >= 1) {
        confidence = "Medium";
    } else {
        confidence = "Low";
    }

    // Return matched pattern or general advisory
    if (bestMatch && bestMatchScore > 0) {
        return {
            condition: bestMatch.condition,
            confidence,
            recommendation: bestMatch.recommendation
        };
    }

    // No specific pattern matched - provide general advice based on top label
    const topLabel = labels[0].label;
    return {
        condition: `Detected: ${topLabel.charAt(0).toUpperCase() + topLabel.slice(1)}`,
        confidence: "Low",
        recommendation: `The image analysis identified "${topLabel}" as the primary feature. For agricultural advice specific to crop diseases or pests, please upload a clear image of leaves or affected plant parts. Ensure good lighting and focus on problem areas.`
    };
}

/**
 * Generates a localized condition name for Hindi language.
 * 
 * @param condition - The English condition name
 * @returns Hindi translation of the condition
 */
export function getLocalizedCondition(condition: string, language: string): string {
    if (language !== "hi") return condition;

    const translations: Record<string, string> = {
        "Possible Nutrient Deficiency": "संभावित पोषक तत्वों की कमी",
        "Water Stress Detected": "पानी की कमी का पता चला",
        "Leaf Damage / Environmental Stress": "पत्ती क्षति / पर्यावरणीय तनाव",
        "Possible Fungal Infection": "संभावित फफूंद संक्रमण",
        "Rust Disease Suspected": "रस्ट रोग का संदेह",
        "Mold/Mildew Infection": "फफूंद/मिल्ड्यू संक्रमण",
        "Blight or Rot Disease": "झुलसा या सड़न रोग",
        "Pest Infestation": "कीट संक्रमण",
        "Insect Feeding Damage": "कीट द्वारा खाने से नुकसान",
        "Healthy Plant": "स्वस्थ पौधा",
        "General Plant Identified": "सामान्य पौधा पहचाना गया",
        "Analysis Unavailable": "विश्लेषण उपलब्ध नहीं",
        "Unable to Identify": "पहचानने में असमर्थ"
    };

    return translations[condition] || condition;
}

/**
 * Generates a localized recommendation for Hindi language.
 * 
 * @param advisory - The agricultural advisory
 * @returns Hindi translation of the recommendation
 */
export function getLocalizedRecommendation(recommendation: string, language: string): string {
    if (language !== "hi") return recommendation;

    // Simplified Hindi translations for common recommendations
    const translations: Record<string, string> = {
        "Your crop appears healthy! Continue current care practices. Maintain consistent watering schedule. Monitor regularly for early signs of stress. Consider preventive organic treatments. Ensure adequate nutrition through compost or balanced fertilizer.":
            "आपकी फसल स्वस्थ दिखती है! वर्तमान देखभाल जारी रखें। नियमित पानी देते रहें। तनाव के शुरुआती संकेतों के लिए नियमित निगरानी करें। जैविक उपचार पर विचार करें। खाद के माध्यम से पर्याप्त पोषण सुनिश्चित करें।",

        "Unable to analyze the image at this time. For best results, ensure good lighting and a clear view of the plant. Take close-up photos of any problem areas. You can try again or consult a local agricultural expert for in-person diagnosis.":
            "इस समय छवि का विश्लेषण करने में असमर्थ। बेहतर परिणाम के लिए अच्छी रोशनी और पौधे का स्पष्ट दृश्य सुनिश्चित करें। समस्या वाले क्षेत्रों की क्लोज-अप तस्वीरें लें। आप फिर से प्रयास कर सकते हैं या स्थानीय कृषि विशेषज्ञ से परामर्श करें।"
    };

    return translations[recommendation] || recommendation;
}
