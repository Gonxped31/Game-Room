import { ITEMS_PER_ROUND } from "./constants";
import { type CurrentRound, makeRound } from "./game";

export interface PromptEntry {
  prompt: string;
  items: string[];
}

/** Built-in prompt bank. Every entry must have exactly ITEMS_PER_ROUND unique items - see lib/prompts.test.ts. */
export const PROMPTS: PromptEntry[] = [
  { prompt: "Pizza toppings", items: ["Pepperoni", "Mushrooms", "Pineapple", "Anchovies", "Jalapenos"] },
  { prompt: "Ways to spend a Sunday", items: ["Long nap", "Hike", "Brunch", "Cleaning", "Video games"] },
  { prompt: "Road trip snacks", items: ["Chips", "Gummy bears", "Fruit", "Beef jerky", "Trail mix"] },
  { prompt: "Movie genres", items: ["Comedy", "Horror", "Romance", "Sci-fi", "Documentary"] },
  { prompt: "Pets to own", items: ["Dog", "Cat", "Parrot", "Snake", "Goldfish"] },
  { prompt: "Breakfast foods", items: ["Pancakes", "Eggs", "Cereal", "Bacon", "Yogurt"] },
  { prompt: "Vacation spots", items: ["Beach", "Mountains", "Big city", "Countryside", "Cruise"] },
  { prompt: "Ice cream flavors", items: ["Vanilla", "Chocolate", "Strawberry", "Mint chip", "Cookie dough"] },
  { prompt: "Superpowers", items: ["Flight", "Invisibility", "Super strength", "Mind reading", "Time travel"] },
  { prompt: "Fast food chains", items: ["McDonald's", "Wendy's", "Taco Bell", "Chick-fil-A", "Burger King"] },
  { prompt: "Board games", items: ["Monopoly", "Scrabble", "Clue", "Risk", "Chess"] },
  { prompt: "Coffee orders", items: ["Black coffee", "Latte", "Cappuccino", "Cold brew", "Espresso"] },
  { prompt: "Workout types", items: ["Running", "Weightlifting", "Yoga", "Swimming", "Cycling"] },
  { prompt: "Household chores", items: ["Dishes", "Laundry", "Vacuuming", "Bathroom", "Dusting"] },
  { prompt: "Social media apps", items: ["Instagram", "TikTok", "Twitter", "Facebook", "Snapchat"] },
  { prompt: "Types of music", items: ["Pop", "Rock", "Hip hop", "Country", "Jazz"] },
  { prompt: "Sandwich fillings", items: ["Turkey", "Ham", "Peanut butter", "Grilled cheese", "BLT"] },
  { prompt: "Desserts", items: ["Cake", "Pie", "Cookies", "Brownies", "Cheesecake"] },
  { prompt: "Ways to get around town", items: ["Car", "Bike", "Train", "Bus", "Walking"] },
  { prompt: "School subjects", items: ["Math", "Science", "History", "Art", "Gym"] },
  { prompt: "Types of weather", items: ["Sunny", "Rainy", "Snowy", "Windy", "Foggy"] },
  { prompt: "Kitchen appliances", items: ["Microwave", "Blender", "Toaster", "Air fryer", "Coffee maker"] },
  { prompt: "Holidays", items: ["Christmas", "Halloween", "Thanksgiving", "Fourth of July", "New Year's"] },
  { prompt: "Cereal brands", items: ["Cheerios", "Froot Loops", "Frosted Flakes", "Raisin Bran", "Cinnamon Toast Crunch"] },
  { prompt: "Common fears", items: ["Spiders", "Heights", "Public speaking", "The dark", "Needles"] },
  { prompt: "Zoo animals", items: ["Lion", "Elephant", "Giraffe", "Penguin", "Monkey"] },
  { prompt: "Car features", items: ["Heated seats", "Sunroof", "Backup camera", "Cruise control", "Leather seats"] },
  { prompt: "Comfort foods", items: ["Mac and cheese", "Mashed potatoes", "Chicken soup", "Grilled cheese", "Pizza"] },
  { prompt: "Things to do alone", items: ["Cat videos", "Alone time", "Leftovers", "Country music", "Pineapple on pizza"] },
  { prompt: "Houseplants", items: ["Succulent", "Fern", "Pothos", "Cactus", "Orchid"] },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Picks a random built-in prompt (never `avoidPrompt`), with its item order shuffled. */
export function randomRound(avoidPrompt?: string): CurrentRound {
  const pool = avoidPrompt ? PROMPTS.filter((p) => p.prompt !== avoidPrompt) : PROMPTS;
  const choice = pool[Math.floor(Math.random() * pool.length)];
  return makeRound(choice.prompt, shuffle(choice.items));
}

/** Builds a round from a player-submitted prompt + exactly ITEMS_PER_ROUND items, shuffled. */
export function customRound(prompt: string, items: string[]): CurrentRound {
  if (items.length !== ITEMS_PER_ROUND) {
    throw new Error(`A custom prompt needs exactly ${ITEMS_PER_ROUND} items, got ${items.length}.`);
  }
  return makeRound(prompt, shuffle(items));
}
