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
        image: "https://m.media-amazon.com/images/I/61N+pQ5O5IL.jpg",
        targetDiseases: ["blight", "rot", "mildew", "wilt"],
        phoneOrder: "+919999999999"
    },
    {
        id: "p2",
        name: "Amistar Top Fungicide",
        brand: "Syngenta",
        price: 320,
        image: "https://m.media-amazon.com/images/I/51wXQcK2LQL.jpg",
        targetDiseases: ["rust", "spot", "scab", "fungus"],
        phoneOrder: "+919999999999"
    },
    {
        id: "p3",
        name: "Coragen Insecticide",
        brand: "FMC",
        price: 850,
        image: "https://m.media-amazon.com/images/I/51ZpY6W7ZBL.jpg",
        targetDiseases: ["borer", "worm", "caterpillar", "pest", "insect"],
        phoneOrder: "+919999999999"
    },
    {
        id: "p4",
        name: "Neem Oil Extract (Organic)",
        brand: "AgroStar",
        price: 250,
        image: "https://m.media-amazon.com/images/I/61B1S3oD7UL.jpg",
        targetDiseases: ["aphid", "mite", "whitefly", "bug", "spider"],
        phoneOrder: "+919999999999"
    },
    {
        id: "p5",
        name: "NPK 19:19:19 Fertilizer",
        brand: "IFFCO",
        price: 150,
        image: "https://m.media-amazon.com/images/I/71I9p1+7qSL.jpg",
        targetDiseases: ["deficiency", "weak", "yellow", "stunted"],
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
