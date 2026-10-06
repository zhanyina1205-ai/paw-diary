export type Stage = 'puppy' | 'adult';
export type FoodUnit = 'kcal100g' | 'kcalkg' | 'kcalpiece';
export type Role = 'main' | 'treat' | 'addon';
export interface Member { id: string; name: string; admin: boolean }
export interface Family { id: string; name: string; version: number; members: Member[] }
export interface Pet {
  id: string; familyId: string; name: string; birthday: string; breed: string;
  stage: Stage; neutered: boolean; weaned: boolean; bodyCondition: number;
  meals: number; vetTarget: number | null; freshPercent: number; mainFoodId: string;
  mainRecipeId: string; snackPercent: number; archived?: boolean;
}
export interface Weight { id: string; familyId: string; petId: string; date: string; kg: number; updatedAt?: string }
export interface Food { id: string; familyId: string; name: string; unit: FoodUnit; energy: number | null; complete: boolean; role: Role }
export interface Ingredient { name: string; grams: number; energy: number | null }
export interface Supplement { name: string; amount: number; unit: string }
export interface Recipe {
  id: string; familyId: string; name: string; purpose: 'main' | 'addon'; source: string;
  stages: Stage[]; basis: 'raw' | 'cooked'; batchEnergy: number | null;
  ingredients: Ingredient[]; supplements: Supplement[]; verified: boolean; version: number;
}
export interface Feeding {
  id: string; familyId: string; petId: string; date: string; time: string;
  itemType: 'food' | 'recipe'; itemId: string; amount: number;
  snapshot: { name: string; unit: 'g' | '个'; calories: number | null; role: Role; recipeVersion?: number };
  actorId: string; actorName: string; createdAt: string; requestId: string;
}
export interface Diary {
  id: string; familyId: string; petId: string; date: string; text: string;
  photos: string[]; weight: number | null; stool: string; color: string; abnormal: string;
  actorName: string;
}
export interface HealthPlan {
  id: string; familyId: string; petId: string; kind: 'vaccine' | 'internal' | 'external' | 'checkup';
  name: string; recordDate: string; dueDate: string; dose: string; hospital: string; product: string;
  notes: string; attachments: string[]; repeatDays: number | null; advanceDays: number;
  completedAt: string | null; previousId?: string; revision: number;
}
export interface State {
  schemaVersion: 1; family: Family; currentUser: Member; pets: Pet[]; weights: Weight[];
  foods: Food[]; recipes: Recipe[]; feedings: Feeding[]; diaries: Diary[]; healthPlans: HealthPlan[];
}
export type Entity = 'pet' | 'weight' | 'food' | 'recipe' | 'diary' | 'health';
export type Command =
  | { type: 'save'; entity: Entity; value: any }
  | { type: 'delete'; entity: Entity | 'feeding'; id: string }
  | { type: 'feed'; id: string; petId: string; date: string; time: string; itemType: 'food' | 'recipe'; itemId: string; amount: number; requestId: string }
  | { type: 'completeHealth'; id: string; date: string }
  | { type: 'removeMember'; id: string }
  | { type: 'rename'; name: string };
