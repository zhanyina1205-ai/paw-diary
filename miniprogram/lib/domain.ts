import { State, Pet, Food, Recipe, HealthPlan } from './types';

export const CHINA_OFFSET = 8 * 60 * 60 * 1000;
export function today(now = new Date()): string { return new Date(now.getTime() + CHINA_OFFSET).toISOString().slice(0, 10); }
export function clockTime(now = new Date()): string { return new Date(now.getTime() + CHINA_OFFSET).toISOString().slice(11, 16); }
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function daysBetween(a: string, b: string): number { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000); }
export function addDays(date: string, days: number): string { return new Date(Date.parse(date + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10); }
export function addMonths(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const base = new Date(Date.UTC(year, month - 1 + months, 1));
  const maxDay = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  base.setUTCDate(Math.min(day, maxDay));
  return base.toISOString().slice(0, 10);
}
export function age(birthday: string, date = today()): { months: number; days: number; label: string } {
  if (!validDate(birthday) || birthday > date) return { months: 0, days: 0, label: '生日待确认' };
  const [y, m] = birthday.split('-').map(Number), [cy, cm] = date.split('-').map(Number);
  let months = (cy - y) * 12 + cm - m;
  if (addMonths(birthday, months) > date) months--;
  const days = daysBetween(addMonths(birthday, months), date);
  return { months, days, label: `${months}个月${days}天` };
}
export function round(n: number, places = 1): number { return Math.round((n + Number.EPSILON) * 10 ** places) / 10 ** places; }
export function foodDensity(food: Food): number | null {
  if (food.energy == null || food.energy < 0) return null;
  return food.energy / (food.unit === 'kcalkg' ? 1000 : food.unit === 'kcal100g' ? 100 : 1);
}
export function recipeEnergy(recipe: Recipe): number | null {
  if (recipe.batchEnergy != null && recipe.batchEnergy > 0) return recipe.batchEnergy;
  if (!recipe.ingredients.length || recipe.ingredients.some(i => i.energy == null)) return null;
  return recipe.ingredients.reduce((sum, i) => sum + i.grams * (i.energy as number) / 100, 0) || null;
}
export function recipeGrams(recipe: Recipe): number { return recipe.ingredients.reduce((s, i) => s + i.grams, 0); }
export function recipeEligible(recipe: Recipe | undefined, pet: Pet): boolean {
  return !!recipe && recipe.purpose === 'main' && recipe.verified && !!recipe.source.trim() && recipe.stages.includes(pet.stage);
}
export function scaleRecipe(recipe: Recipe, calories: number, days = 1) {
  const energy = recipeEnergy(recipe);
  if (!energy || calories <= 0 || days <= 0) return null;
  const factor = calories * days / energy;
  return {
    factor, totalGrams: round(recipeGrams(recipe) * factor), totalCalories: round(calories * days),
    ingredients: recipe.ingredients.map(i => ({ ...i, grams: Number((i.grams * factor).toPrecision(6)), percent: round(i.grams / recipeGrams(recipe) * 100) })),
    supplements: recipe.supplements.map(s => ({ ...s, amount: Number((s.amount * factor).toPrecision(6)) }))
  };
}
export function nutrition(state: State, pet: Pet, date = today()) {
  const weights = state.weights.filter(w => w.petId === pet.id && w.date <= date).sort((a, b) => b.date.localeCompare(a.date) || (b.updatedAt||'').localeCompare(a.updatedAt||''));
  const weight = weights[0] || null;
  const rer = weight ? 70 * weight.kg ** .75 : null;
  const factor = pet.stage === 'puppy' ? (date < addMonths(pet.birthday, 4) ? 3 : 2) : (pet.neutered ? 1.6 : 1.8);
  const target = pet.vetTarget || (rer && pet.weaned ? rer * factor : null);
  const logs = state.feedings.filter(f => f.petId === pet.id && f.date === date).sort((a, b) => b.time.localeCompare(a.time) || b.createdAt.localeCompare(a.createdAt));
  const fed = logs.reduce((n, l) => n + (l.snapshot.calories || 0), 0);
  const snackFed = logs.filter(l => l.snapshot.role !== 'main').reduce((n, l) => n + (l.snapshot.calories || 0), 0);
  const snackLimit = target == null ? null : target * .1;
  const snackBudget = target == null ? null : target * pet.snackPercent / 100;
  const mainBudget = target == null ? null : target - (snackBudget || 0);
  const food = state.foods.find(f => f.id === pet.mainFoodId);
  const recipe = state.recipes.find(r => r.id === pet.mainRecipeId);
  const freshCalories = mainBudget == null ? null : mainBudget * pet.freshPercent / 100;
  const dryCalories = mainBudget == null ? null : mainBudget * (1 - pet.freshPercent / 100);
  const density = food && food.complete && food.unit !== 'kcalpiece' ? foodDensity(food) : null;
  const dryGrams = dryCalories === 0 ? 0 : dryCalories != null && density ? dryCalories / density : null;
  const recipeKcal = recipe && recipeEligible(recipe, pet) ? recipeEnergy(recipe) : null;
  const freshGrams = freshCalories === 0 ? 0 : freshCalories != null && recipe && recipeKcal ? freshCalories / recipeKcal * recipeGrams(recipe) : null;
  const incomplete = logs.some(l => l.snapshot.calories == null);
  const remaining = target == null ? null : Math.max(0, target - fed);
  const snackStatus = snackLimit == null ? '待完善资料' : snackFed > snackLimit ? '加餐已超额' : snackFed >= snackLimit * .8 && snackFed > 0 ? '接近加餐上限' : '加餐额度充足';
  return {
    weight, rer, factor, target, logs, fed, snackFed, snackLimit, snackBudget, mainBudget,
    freshCalories, dryCalories, dryGrams, freshGrams, remaining, incomplete,
    over: target != null && fed > target, snackStatus,
    dryPerMeal: dryGrams == null ? null : dryGrams / pet.meals,
    freshPerMeal: freshGrams == null ? null : freshGrams / pet.meals,
    recipeReady: recipeEligible(recipe, pet), progress: target ? Math.min(100, fed / target * 100) : 0,
    source: pet.vetTarget ? '采用兽医热量目标' : `RER × ${factor} · AAHA 初始估算`,
    weightStale: !!weight && daysBetween(weight.date, date) > (pet.stage === 'puppy' ? 7 : 30),
  };
}
export function healthStatus(plan: HealthPlan, date = today()) {
  if (plan.completedAt) return { label: '已完成', level: 'done', days: 0 };
  const days = daysBetween(date, plan.dueDate);
  return { days, label: days < 0 ? `逾期${-days}天` : days === 0 ? '今天到期' : `${days}天后`, level: days < 0 ? 'overdue' : days <= plan.advanceDays ? 'soon' : 'later' };
}
export function calendarEvent(plan: HealthPlan, pet: Pet) {
  return { title: `${pet.name} · ${plan.name}`, startTime: Date.parse(`${plan.dueDate}T09:00:00+08:00`) / 1000,
    endTime: String(Date.parse(`${plan.dueDate}T09:30:00+08:00`) / 1000), alarm: true, alarmOffset: 86400,
    description: `${plan.hospital || plan.product || ''} ${plan.notes}\n爪爪日记：计划改期或完成后，请手动调整日历事件。` };
}
