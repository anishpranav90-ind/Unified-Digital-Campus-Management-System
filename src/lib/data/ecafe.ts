export type CafeMenuItem = {
  id: string;
  name: string;
  category: "veg" | "non-veg";
  description: string;
  price: number;
};

export const ECAFE_MENU: CafeMenuItem[] = [
  {
    id: "masala-dosa",
    name: "Masala dosa",
    category: "veg",
    description: "Crisp rice crepe with spiced potato, sambar and chutney.",
    price: 60,
  },
  {
    id: "paneer-roll",
    name: "Paneer tikka roll",
    category: "veg",
    description: "Grilled paneer, peppers and mint chutney in a soft wrap.",
    price: 85,
  },
  {
    id: "veg-pulao",
    name: "Vegetable pulao",
    category: "veg",
    description: "Fragrant rice with seasonal vegetables and raita.",
    price: 90,
  },
  {
    id: "chicken-biryani",
    name: "Chicken biryani",
    category: "non-veg",
    description: "Aromatic basmati rice with spiced chicken and raita.",
    price: 140,
  },
  {
    id: "egg-roll",
    name: "Egg roll",
    category: "non-veg",
    description: "Two-egg roll with onions and a tangy house sauce.",
    price: 75,
  },
  {
    id: "chicken-sandwich",
    name: "Grilled chicken sandwich",
    category: "non-veg",
    description: "Grilled chicken, lettuce and pepper mayo on toasted bread.",
    price: 110,
  },
];
