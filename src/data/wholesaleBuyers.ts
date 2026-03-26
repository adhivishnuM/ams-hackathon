export interface WholesaleBuyer {
  id: string;
  name: string;
  agentName: string;
  location: string;
  district: string;
  state: string;
  phone: string;
  crops: string[];
  capacityPerWeek: string;
  priceRange: string;
  rating: number;
  verified: boolean;
  languages: string[];
  paymentTerms: string;
  experience: string;
}

export const wholesaleBuyers: WholesaleBuyer[] = [
  // Chennai (5)
  {
    id: "wb_001", name: "Chennai Fresh Agro Pvt Ltd", agentName: "Rajesh Kumar",
    location: "Koyambedu Market", district: "Chennai", state: "Tamil Nadu",
    phone: "+91 98410 XXXXX", crops: ["Tomato", "Onion", "Potato", "Carrot"],
    capacityPerWeek: "50–200 quintals", priceRange: "₹800–₹2000/quintal",
    rating: 4.7, verified: true, languages: ["Tamil", "English", "Hindi"],
    paymentTerms: "Immediate cash / 2-day NEFT", experience: "15 years"
  },
  {
    id: "wb_002", name: "Metro Vegetables Trader", agentName: "Suresh Babu",
    location: "Madavaram", district: "Chennai", state: "Tamil Nadu",
    phone: "+91 94440 XXXXX", crops: ["Brinjal", "Drumstick", "Banana", "Mango"],
    capacityPerWeek: "30–150 quintals", priceRange: "₹600–₹3000/quintal",
    rating: 4.5, verified: true, languages: ["Tamil", "Telugu"],
    paymentTerms: "Same-day payment via UPI", experience: "10 years"
  },
  {
    id: "wb_003", name: "TN Grain Exports", agentName: "Anand Krishnamurthy",
    location: "Saidapet", district: "Chennai", state: "Tamil Nadu",
    phone: "+91 99400 XXXXX", crops: ["Rice", "Wheat", "Maize", "Ragi"],
    capacityPerWeek: "100–500 quintals", priceRange: "₹1200–₹2500/quintal",
    rating: 4.8, verified: true, languages: ["Tamil", "English"],
    paymentTerms: "Advance 30% + balance on delivery", experience: "20 years"
  },
  {
    id: "wb_004", name: "Green Valley Wholesale", agentName: "Priya Sundaram",
    location: "Ambattur", district: "Chennai", state: "Tamil Nadu",
    phone: "+91 93810 XXXXX", crops: ["Capsicum", "Cucumber", "Beans", "Peas"],
    capacityPerWeek: "20–80 quintals", priceRange: "₹500–₹1800/quintal",
    rating: 4.3, verified: false, languages: ["Tamil"],
    paymentTerms: "Weekly settlement every Monday", experience: "6 years"
  },
  {
    id: "wb_005", name: "Chennai Spice Hub", agentName: "Murugan R",
    location: "Broadway Market", district: "Chennai", state: "Tamil Nadu",
    phone: "+91 97100 XXXXX", crops: ["Chilli", "Turmeric", "Coriander", "Pepper"],
    capacityPerWeek: "10–60 quintals", priceRange: "₹3000–₹15000/quintal",
    rating: 4.6, verified: true, languages: ["Tamil", "Hindi"],
    paymentTerms: "Immediate cash on receipt", experience: "12 years"
  },

  // Coimbatore (5)
  {
    id: "wb_006", name: "Kovai Agro Traders", agentName: "Senthilkumar V",
    location: "Ukkadam Market", district: "Coimbatore", state: "Tamil Nadu",
    phone: "+91 98423 XXXXX", crops: ["Banana", "Coconut", "Turmeric", "Potato"],
    capacityPerWeek: "80–300 quintals", priceRange: "₹700–₹2200/quintal",
    rating: 4.9, verified: true, languages: ["Tamil", "Kannada"],
    paymentTerms: "Immediate payment + transport arranged", experience: "18 years"
  },
  {
    id: "wb_007", name: "Western TN Wholesale", agentName: "Balamurugan K",
    location: "Mettupalayam Road", district: "Coimbatore", state: "Tamil Nadu",
    phone: "+91 96005 XXXXX", crops: ["Maize", "Soybean", "Groundnut", "Sunflower"],
    capacityPerWeek: "200–800 quintals", priceRange: "₹1500–₹5000/quintal",
    rating: 4.4, verified: true, languages: ["Tamil"],
    paymentTerms: "Net 7 days after delivery", experience: "22 years"
  },
  {
    id: "wb_008", name: "Coimbatore Fresh Hub", agentName: "Deepa Narayanan",
    location: "RS Puram", district: "Coimbatore", state: "Tamil Nadu",
    phone: "+91 90037 XXXXX", crops: ["Tomato", "Onion", "Garlic", "Ginger"],
    capacityPerWeek: "40–160 quintals", priceRange: "₹400–₹3500/quintal",
    rating: 4.6, verified: true, languages: ["Tamil", "English"],
    paymentTerms: "Daily market rate + same-day UPI", experience: "9 years"
  },
  {
    id: "wb_009", name: "Nilgiri Produce Exporters", agentName: "Subramaniam P",
    location: "Ooty Bypass Road", district: "Coimbatore", state: "Tamil Nadu",
    phone: "+91 95670 XXXXX", crops: ["Carrot", "Beans", "Cabbage", "Capsicum"],
    capacityPerWeek: "25–100 quintals", priceRange: "₹800–₹2800/quintal",
    rating: 4.7, verified: true, languages: ["Tamil", "English"],
    paymentTerms: "Advance booking with 25% deposit", experience: "14 years"
  },
  {
    id: "wb_010", name: "Kongu Cotton Traders", agentName: "Arumugam S",
    location: "Tirupur Road", district: "Coimbatore", state: "Tamil Nadu",
    phone: "+91 98765 XXXXX", crops: ["Cotton", "Maize", "Groundnut"],
    capacityPerWeek: "500–2000 quintals", priceRange: "₹4000–₹8000/quintal",
    rating: 4.5, verified: true, languages: ["Tamil"],
    paymentTerms: "MSP + bonus, payment within 3 days", experience: "25 years"
  },

  // Madurai (5)
  {
    id: "wb_011", name: "Madurai Mandi Express", agentName: "Kalaiselvan M",
    location: "Mattuthavani Market", district: "Madurai", state: "Tamil Nadu",
    phone: "+91 94430 XXXXX", crops: ["Banana", "Jasmine", "Rose", "Marigold"],
    capacityPerWeek: "60–250 quintals", priceRange: "₹500–₹5000/quintal",
    rating: 4.8, verified: true, languages: ["Tamil"],
    paymentTerms: "Morning market rate, cash same day", experience: "16 years"
  },
  {
    id: "wb_012", name: "South TN Agri Links", agentName: "Pandian A",
    location: "Alanganallur", district: "Madurai", state: "Tamil Nadu",
    phone: "+91 98429 XXXXX", crops: ["Cotton", "Sorghum", "Pearl Millet", "Black Gram"],
    capacityPerWeek: "150–600 quintals", priceRange: "₹1800–₹7000/quintal",
    rating: 4.3, verified: true, languages: ["Tamil"],
    paymentTerms: "Government MSP guarantee", experience: "20 years"
  },
  {
    id: "wb_013", name: "Meenakshi Agro Exports", agentName: "Selvi Lakshmi",
    location: "Tallakulam", district: "Madurai", state: "Tamil Nadu",
    phone: "+91 90090 XXXXX", crops: ["Tomato", "Brinjal", "Drumstick", "Bitter Gourd"],
    capacityPerWeek: "30–120 quintals", priceRange: "₹600–₹2500/quintal",
    rating: 4.6, verified: false, languages: ["Tamil", "English"],
    paymentTerms: "Weekly payment every Friday", experience: "8 years"
  },
  {
    id: "wb_014", name: "Temple City Traders", agentName: "Venkatesh G",
    location: "Palanganatham", district: "Madurai", state: "Tamil Nadu",
    phone: "+91 96771 XXXXX", crops: ["Chilli", "Turmeric", "Coriander"],
    capacityPerWeek: "15–75 quintals", priceRange: "₹2500–₹12000/quintal",
    rating: 4.7, verified: true, languages: ["Tamil", "Telugu"],
    paymentTerms: "Spot cash, no delay", experience: "11 years"
  },
  {
    id: "wb_015", name: "Vaigai Valley Wholesale", agentName: "Raman Subramanian",
    location: "Vadipatti", district: "Madurai", state: "Tamil Nadu",
    phone: "+91 94880 XXXXX", crops: ["Rice", "Groundnut", "Sesame"],
    capacityPerWeek: "100–400 quintals", priceRange: "₹1400–₹6000/quintal",
    rating: 4.5, verified: true, languages: ["Tamil"],
    paymentTerms: "Advance 40% on booking", experience: "17 years"
  },

  // Salem (5)
  {
    id: "wb_016", name: "Salem Steel City Agro", agentName: "Marimuthu K",
    location: "Shevapet Market", district: "Salem", state: "Tamil Nadu",
    phone: "+91 97878 XXXXX", crops: ["Mango", "Turmeric", "Banana", "Maize"],
    capacityPerWeek: "70–280 quintals", priceRange: "₹800–₹4000/quintal",
    rating: 4.6, verified: true, languages: ["Tamil", "Kannada"],
    paymentTerms: "Immediate after quality check", experience: "13 years"
  },
  {
    id: "wb_017", name: "Kongu Produce Hub", agentName: "Chinnasamy R",
    location: "Omalur", district: "Salem", state: "Tamil Nadu",
    phone: "+91 98430 XXXXX", crops: ["Onion", "Potato", "Tomato"],
    capacityPerWeek: "100–500 quintals", priceRange: "₹400–₹2000/quintal",
    rating: 4.4, verified: true, languages: ["Tamil"],
    paymentTerms: "Daily market rate, same-day payment", experience: "19 years"
  },
  {
    id: "wb_018", name: "Salem Flower Market", agentName: "Palaniswami T",
    location: "Suramangalam", district: "Salem", state: "Tamil Nadu",
    phone: "+91 90940 XXXXX", crops: ["Jasmine", "Rose", "Chrysanthemum"],
    capacityPerWeek: "5–25 quintals", priceRange: "₹500–₹3000/quintal",
    rating: 4.8, verified: true, languages: ["Tamil"],
    paymentTerms: "Morning auction, immediate cash", experience: "8 years"
  },
  {
    id: "wb_019", name: "Silveroak Agri Exports", agentName: "Sridharan N",
    location: "Mettur Dam Road", district: "Salem", state: "Tamil Nadu",
    phone: "+91 95000 XXXXX", crops: ["Sugarcane", "Cotton", "Groundnut"],
    capacityPerWeek: "500–2000 quintals", priceRange: "₹350–₹6500/quintal",
    rating: 4.3, verified: false, languages: ["Tamil", "English"],
    paymentTerms: "Factory direct payment, 5-day cycle", experience: "24 years"
  },
  {
    id: "wb_020", name: "Tamil Mango Traders", agentName: "Govindarajan L",
    location: "Danishpet", district: "Salem", state: "Tamil Nadu",
    phone: "+91 94456 XXXXX", crops: ["Alphonso Mango", "Banganapalli", "Neelam Mango"],
    capacityPerWeek: "20–100 quintals", priceRange: "₹2000–₹8000/quintal",
    rating: 4.9, verified: true, languages: ["Tamil", "English"],
    paymentTerms: "Export quality premium pricing", experience: "15 years"
  },

  // Trichy (5)
  {
    id: "wb_021", name: "Trichy Central Agri", agentName: "Periyasamy M",
    location: "Ariyamangalam Market", district: "Tiruchirappalli", state: "Tamil Nadu",
    phone: "+91 98941 XXXXX", crops: ["Rice", "Paddy", "Groundnut", "Sesame"],
    capacityPerWeek: "200–800 quintals", priceRange: "₹1200–₹5500/quintal",
    rating: 4.7, verified: true, languages: ["Tamil"],
    paymentTerms: "Government mandated MSP + cash", experience: "21 years"
  },
  {
    id: "wb_022", name: "Rock Fort Vegetables", agentName: "Kavitha Rangan",
    location: "Thillai Nagar", district: "Tiruchirappalli", state: "Tamil Nadu",
    phone: "+91 93000 XXXXX", crops: ["Onion", "Tomato", "Potato", "Drumstick"],
    capacityPerWeek: "50–200 quintals", priceRange: "₹500–₹2200/quintal",
    rating: 4.5, verified: true, languages: ["Tamil", "English"],
    paymentTerms: "Bi-weekly settlement", experience: "10 years"
  },
  {
    id: "wb_023", name: "Cauvery Agro Links", agentName: "Thangaraj P",
    location: "Golden Rock", district: "Tiruchirappalli", state: "Tamil Nadu",
    phone: "+91 97508 XXXXX", crops: ["Banana", "Coconut", "Jackfruit"],
    capacityPerWeek: "60–240 quintals", priceRange: "₹600–₹3500/quintal",
    rating: 4.6, verified: true, languages: ["Tamil"],
    paymentTerms: "Truck arrival basis, immediate payment", experience: "13 years"
  },
  {
    id: "wb_024", name: "Tiruchi Spice Traders", agentName: "Sekar K",
    location: "Srirangam", district: "Tiruchirappalli", state: "Tamil Nadu",
    phone: "+91 94870 XXXXX", crops: ["Pepper", "Cardamom", "Clove", "Star Anise"],
    capacityPerWeek: "5–30 quintals", priceRange: "₹8000–₹50000/quintal",
    rating: 4.8, verified: true, languages: ["Tamil", "English"],
    paymentTerms: "Premium pricing, advance booking only", experience: "18 years"
  },
  {
    id: "wb_025", name: "Delta Rice Mills", agentName: "Elango S",
    location: "Musiri", district: "Tiruchirappalli", state: "Tamil Nadu",
    phone: "+91 98761 XXXXX", crops: ["Paddy", "Rice (Boiled)", "Rice (Raw)"],
    capacityPerWeek: "300–1200 quintals", priceRange: "₹1400–₹2200/quintal",
    rating: 4.4, verified: true, languages: ["Tamil"],
    paymentTerms: "Milling contract, payment weekly", experience: "30 years"
  },

  // Tirunelveli (5)
  {
    id: "wb_026", name: "Nellai Banana Traders", agentName: "Jeyakumar A",
    location: "Palayamkottai", district: "Tirunelveli", state: "Tamil Nadu",
    phone: "+91 98422 XXXXX", crops: ["Banana", "Plantain", "Raw Banana"],
    capacityPerWeek: "100–400 quintals", priceRange: "₹800–₹2500/quintal",
    rating: 4.9, verified: true, languages: ["Tamil"],
    paymentTerms: "Daily purchase, immediate payment", experience: "16 years"
  },
  {
    id: "wb_027", name: "Southern Agro Export", agentName: "Manohar V",
    location: "Tirunelveli Junction", district: "Tirunelveli", state: "Tamil Nadu",
    phone: "+91 96290 XXXXX", crops: ["Cotton", "Chilli", "Sesame", "Groundnut"],
    capacityPerWeek: "150–600 quintals", priceRange: "₹1500–₹10000/quintal",
    rating: 4.5, verified: true, languages: ["Tamil", "English"],
    paymentTerms: "Export linked payment, guaranteed", experience: "22 years"
  },
  {
    id: "wb_028", name: "Halwa City Fresh", agentName: "Thirumalai R",
    location: "Melapalayam", district: "Tirunelveli", state: "Tamil Nadu",
    phone: "+91 90921 XXXXX", crops: ["Tomato", "Onion", "Drumstick", "Ladies Finger"],
    capacityPerWeek: "30–130 quintals", priceRange: "₹400–₹2800/quintal",
    rating: 4.3, verified: false, languages: ["Tamil"],
    paymentTerms: "Weekly payment after Sunday auction", experience: "7 years"
  },
  {
    id: "wb_029", name: "Tamiraparani Valley Agro", agentName: "Durai M",
    location: "Ambasamudram", district: "Tirunelveli", state: "Tamil Nadu",
    phone: "+91 94451 XXXXX", crops: ["Rice", "Jackfruit", "Coconut", "Tamarind"],
    capacityPerWeek: "80–320 quintals", priceRange: "₹1000–₹4000/quintal",
    rating: 4.7, verified: true, languages: ["Tamil"],
    paymentTerms: "Harvest season advance booking open", experience: "14 years"
  },
  {
    id: "wb_030", name: "Silk Route Spices", agentName: "Muthu Krishnan",
    location: "Sankarankovil", district: "Tirunelveli", state: "Tamil Nadu",
    phone: "+91 97150 XXXXX", crops: ["Turmeric", "Pepper", "Coriander Seeds"],
    capacityPerWeek: "10–50 quintals", priceRange: "₹5000–₹18000/quintal",
    rating: 4.8, verified: true, languages: ["Tamil", "Hindi"],
    paymentTerms: "Spot cash, negotiable for bulk", experience: "20 years"
  },

  // Erode (5)
  {
    id: "wb_031", name: "Erode Turmeric Traders", agentName: "Sivakumar P",
    location: "Erode Turmeric Market", district: "Erode", state: "Tamil Nadu",
    phone: "+91 98944 XXXXX", crops: ["Turmeric", "Ginger"],
    capacityPerWeek: "20–200 quintals", priceRange: "₹4000–₹15000/quintal",
    rating: 4.9, verified: true, languages: ["Tamil", "English"],
    paymentTerms: "Asia's largest turmeric market rates, immediate", experience: "28 years"
  },
  {
    id: "wb_032", name: "Kongu Cotton Exchange", agentName: "Veeramani C",
    location: "Erode Cotton Market", district: "Erode", state: "Tamil Nadu",
    phone: "+91 94865 XXXXX", crops: ["Cotton", "Groundnut", "Sunflower"],
    capacityPerWeek: "500–3000 quintals", priceRange: "₹5000–₹8500/quintal",
    rating: 4.6, verified: true, languages: ["Tamil"],
    paymentTerms: "NCDEX price linked, 2-day payment", experience: "23 years"
  },
  {
    id: "wb_033", name: "Bhavani Agro Hub", agentName: "Natarajan K",
    location: "Bhavani", district: "Erode", state: "Tamil Nadu",
    phone: "+91 96260 XXXXX", crops: ["Banana", "Sugarcane", "Rice", "Coconut"],
    capacityPerWeek: "100–500 quintals", priceRange: "₹600–₹2800/quintal",
    rating: 4.5, verified: true, languages: ["Tamil"],
    paymentTerms: "Fortnightly payment cycle", experience: "12 years"
  },
  {
    id: "wb_034", name: "Periya Market Wholesale", agentName: "Arul Murugan",
    location: "Perundurai", district: "Erode", state: "Tamil Nadu",
    phone: "+91 93848 XXXXX", crops: ["Maize", "Sorghum", "Finger Millet"],
    capacityPerWeek: "200–800 quintals", priceRange: "₹1200–₹2800/quintal",
    rating: 4.4, verified: false, languages: ["Tamil"],
    paymentTerms: "FCI procurement price guarantee", experience: "15 years"
  },
  {
    id: "wb_035", name: "Western Ghats Produce", agentName: "Chinnadurai P",
    location: "Anthiyur", district: "Erode", state: "Tamil Nadu",
    phone: "+91 98437 XXXXX", crops: ["Coffee", "Pepper", "Cardamom", "Orange"],
    capacityPerWeek: "15–60 quintals", priceRange: "₹3000–₹40000/quintal",
    rating: 4.7, verified: true, languages: ["Tamil", "Kannada"],
    paymentTerms: "Quarterly harvest contracts", experience: "19 years"
  },

  // Vellore (5)
  {
    id: "wb_036", name: "Vellore Agri Markets", agentName: "Ramprasad S",
    location: "Katpadi Junction", district: "Vellore", state: "Tamil Nadu",
    phone: "+91 97899 XXXXX", crops: ["Tomato", "Onion", "Groundnut", "Tamarind"],
    capacityPerWeek: "60–240 quintals", priceRange: "₹500–₹4500/quintal",
    rating: 4.5, verified: true, languages: ["Tamil", "Telugu", "English"],
    paymentTerms: "Daily auction, same-day payment", experience: "11 years"
  },
  {
    id: "wb_037", name: "Palar Valley Traders", agentName: "Bhaskar N",
    location: "Ranipet", district: "Vellore", state: "Tamil Nadu",
    phone: "+91 94490 XXXXX", crops: ["Mango", "Brinjal", "Ladies Finger"],
    capacityPerWeek: "30–120 quintals", priceRange: "₹600–₹5000/quintal",
    rating: 4.4, verified: true, languages: ["Tamil", "Telugu"],
    paymentTerms: "Bi-weekly net payment", experience: "8 years"
  },
  {
    id: "wb_038", name: "Fort City Wholesale", agentName: "Muniyan T",
    location: "Gudiyatham", district: "Vellore", state: "Tamil Nadu",
    phone: "+91 98451 XXXXX", crops: ["Cotton", "Groundnut", "Sesame", "Sunflower"],
    capacityPerWeek: "100–400 quintals", priceRange: "₹1800–₹7000/quintal",
    rating: 4.6, verified: true, languages: ["Tamil"],
    paymentTerms: "Government cooperative rates", experience: "17 years"
  },
  {
    id: "wb_039", name: "Border State Agro", agentName: "Krishnaswamy V",
    location: "Walajah", district: "Vellore", state: "Tamil Nadu",
    phone: "+91 90455 XXXXX", crops: ["Rice", "Paddy", "Maize", "Sorghum"],
    capacityPerWeek: "150–600 quintals", priceRange: "₹1200–₹2500/quintal",
    rating: 4.3, verified: false, languages: ["Tamil", "Telugu", "Urdu"],
    paymentTerms: "10-day credit available for registered farmers", experience: "20 years"
  },
  {
    id: "wb_040", name: "Veggie Connect TN", agentName: "Saravanan R",
    location: "Ambur", district: "Vellore", state: "Tamil Nadu",
    phone: "+91 97140 XXXXX", crops: ["Tomato", "Capsicum", "Carrot", "Beans"],
    capacityPerWeek: "25–100 quintals", priceRange: "₹400–₹2500/quintal",
    rating: 4.7, verified: true, languages: ["Tamil", "Urdu"],
    paymentTerms: "Hotel & restaurant direct supply, quick payment", experience: "9 years"
  },

  // Tiruppur (5)
  {
    id: "wb_041", name: "Tiruppur Agri Traders", agentName: "Ilango K",
    location: "Dharapuram Road", district: "Tiruppur", state: "Tamil Nadu",
    phone: "+91 98432 XXXXX", crops: ["Cotton", "Groundnut", "Sesame"],
    capacityPerWeek: "300–1500 quintals", priceRange: "₹4500–₹8000/quintal",
    rating: 4.6, verified: true, languages: ["Tamil"],
    paymentTerms: "Textile mill linked payment, guaranteed", experience: "21 years"
  },
  {
    id: "wb_042", name: "Knitwear City Produce", agentName: "Ganesan M",
    location: "Avinashi Market", district: "Tiruppur", state: "Tamil Nadu",
    phone: "+91 94456 XXXXX", crops: ["Banana", "Coconut", "Tomato", "Onion"],
    capacityPerWeek: "40–180 quintals", priceRange: "₹500–₹2200/quintal",
    rating: 4.5, verified: true, languages: ["Tamil"],
    paymentTerms: "Factory workers supply, weekly payment", experience: "10 years"
  },
  {
    id: "wb_043", name: "Palladam Agro Hub", agentName: "Thilagavathi R",
    location: "Palladam", district: "Tiruppur", state: "Tamil Nadu",
    phone: "+91 96290 XXXXX", crops: ["Maize", "Black Gram", "Cowpea", "Toor Dal"],
    capacityPerWeek: "100–400 quintals", priceRange: "₹1200–₹6000/quintal",
    rating: 4.4, verified: false, languages: ["Tamil"],
    paymentTerms: "Government MSP + 10% premium for organic", experience: "13 years"
  },
  {
    id: "wb_044", name: "Kangeyam Produce Traders", agentName: "Kumaravel S",
    location: "Kangeyam", district: "Tiruppur", state: "Tamil Nadu",
    phone: "+91 98423 XXXXX", crops: ["Cotton", "Sorghum", "Pearl Millet"],
    capacityPerWeek: "200–800 quintals", priceRange: "₹1500–₹8000/quintal",
    rating: 4.7, verified: true, languages: ["Tamil"],
    paymentTerms: "Cooperative society rates, advance available", experience: "18 years"
  },
  {
    id: "wb_045", name: "Udumalpet Valley Agro", agentName: "Rajamani P",
    location: "Udumalpet", district: "Tiruppur", state: "Tamil Nadu",
    phone: "+91 97165 XXXXX", crops: ["Banana", "Turmeric", "Ginger", "Rice"],
    capacityPerWeek: "60–250 quintals", priceRange: "₹800–₹8000/quintal",
    rating: 4.8, verified: true, languages: ["Tamil", "Kannada"],
    paymentTerms: "Direct to processing units, 3-day payment", experience: "16 years"
  },

  // Thanjavur (5)
  {
    id: "wb_046", name: "Delta Rice Traders", agentName: "Velayutham S",
    location: "Thanjavur Big Market", district: "Thanjavur", state: "Tamil Nadu",
    phone: "+91 94453 XXXXX", crops: ["Paddy", "Rice", "Boiled Rice", "Samba Rice"],
    capacityPerWeek: "500–2000 quintals", priceRange: "₹1400–₹2800/quintal",
    rating: 4.9, verified: true, languages: ["Tamil"],
    paymentTerms: "Government procurement price, direct FCI", experience: "30 years"
  },
  {
    id: "wb_047", name: "Cauvery Delta Agri", agentName: "Sundaram K",
    location: "Papanasam", district: "Thanjavur", state: "Tamil Nadu",
    phone: "+91 98431 XXXXX", crops: ["Banana", "Coconut", "Sugarcane"],
    capacityPerWeek: "100–500 quintals", priceRange: "₹700–₹3500/quintal",
    rating: 4.7, verified: true, languages: ["Tamil"],
    paymentTerms: "Sugar mill contract payment", experience: "19 years"
  },
  {
    id: "wb_048", name: "Temple Town Wholesale", agentName: "Anbazhagan M",
    location: "Kumbakonam", district: "Thanjavur", state: "Tamil Nadu",
    phone: "+91 93858 XXXXX", crops: ["Sesame", "Groundnut", "Black Gram", "Green Gram"],
    capacityPerWeek: "50–200 quintals", priceRange: "₹2500–₹8000/quintal",
    rating: 4.6, verified: true, languages: ["Tamil"],
    paymentTerms: "Festival season premium, spot cash", experience: "14 years"
  },
  {
    id: "wb_049", name: "Brahmin Agriculture Net", agentName: "Panchapakesan V",
    location: "Orathanadu", district: "Thanjavur", state: "Tamil Nadu",
    phone: "+91 94462 XXXXX", crops: ["Paddy", "Banana", "Tamarind", "Jackfruit"],
    capacityPerWeek: "80–320 quintals", priceRange: "₹600–₹3000/quintal",
    rating: 4.5, verified: false, languages: ["Tamil", "English"],
    paymentTerms: "10-day credit to trusted farmers", experience: "12 years"
  },
  {
    id: "wb_050", name: "Big Temple Spice Hub", agentName: "Gowrishankar R",
    location: "Srirangam Road", district: "Thanjavur", state: "Tamil Nadu",
    phone: "+91 96260 XXXXX", crops: ["Pepper", "Turmeric", "Coriander", "Cumin"],
    capacityPerWeek: "10–50 quintals", priceRange: "₹4000–₹20000/quintal",
    rating: 4.8, verified: true, languages: ["Tamil", "English", "Hindi"],
    paymentTerms: "Export quality premium + advance", experience: "22 years"
  }
];

export function findBuyersForCrop(crop: string, district?: string): WholesaleBuyer[] {
  const normalizedCrop = crop.toLowerCase();
  return wholesaleBuyers.filter(b => {
    const cropMatch = b.crops.some(c => c.toLowerCase().includes(normalizedCrop) || normalizedCrop.includes(c.toLowerCase()));
    const districtMatch = !district || b.district.toLowerCase().includes(district.toLowerCase()) || b.location.toLowerCase().includes(district.toLowerCase());
    return cropMatch && districtMatch;
  });
}

export function findBuyersByDistrict(district: string): WholesaleBuyer[] {
  return wholesaleBuyers.filter(b => b.district.toLowerCase().includes(district.toLowerCase()));
}
