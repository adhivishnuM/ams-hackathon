export interface Product {
    id: string;
    name: string;
    brand: string;
    price: number;
    image: string;
    targetDiseases: string[];
    phoneOrder?: string;
}

export const agroProducts: Product[] = [
    {
        id: "p1",
        name: "Aliette Systemic Fungicide",
        brand: "Bayer",
        price: 450,
        image: "/branded_fertilizer_illustration_1774425850498.png",
        targetDiseases: ["blight", "rot", "mildew", "wilt", "blackleg", "fungus", "fungicide"],
        phoneOrder: "+919999999999"
    },
    {
        id: "p2",
        name: "Amistar Top Fungicide",
        brand: "Syngenta",
        price: 320,
        image: "/fertilizer_illustration_1774425647452.png",
        targetDiseases: ["rust", "spot", "scab", "blackleg", "fungus", "mold"],
        phoneOrder: "+919999999999"
    },
    {
        id: "p3",
        name: "Coragen Insecticide",
        brand: "FMC",
        price: 850,
        image: "/pesticide_illustration_1774425681752.png",
        targetDiseases: ["borer", "worm", "caterpillar", "pest", "insect", "infestation", "bugs"],
        phoneOrder: "+919999999999"
    },
    {
        id: "p4",
        name: "Neem Oil Extract (Organic)",
        brand: "AgroStar",
        price: 250,
        image: "/seeds_illustration_1774425776436.png",
        targetDiseases: ["aphid", "mite", "whitefly", "bug", "spider", "organic", "neem"],
        phoneOrder: "+919999999999"
    },
    {
        id: "p5",
        name: "NPK 19:19:19 Fertilizer",
        brand: "IFFCO",
        price: 150,
        image: "/fertilizer_illustration_1774425647452.png",
        targetDiseases: ["deficiency", "weak", "yellow", "stunted", "growth", "nutrition", "fertilizer"],
        phoneOrder: "+919999999999"
    }
];

export function getRecommendations(diseaseName: string, symptoms: string[] = []): Product[] {
    const textToSearch = (diseaseName + " " + symptoms.join(" ")).toLowerCase();
    const recommendations = agroProducts.filter(p => 
        p.targetDiseases.some(td => textToSearch.includes(td))
    );
    
    // Fallback logic
    if (recommendations.length === 0) {
        if (textToSearch.includes("pest") || textToSearch.includes("bug")) {
            return [agroProducts[3]];
        }
        return [agroProducts[4]];
    }
    
    return recommendations.slice(0, 2); // Return top 2 matching products
}
