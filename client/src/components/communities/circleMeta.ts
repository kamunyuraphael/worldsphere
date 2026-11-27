import { Droplets, PawPrint, Sprout, type LucideIcon } from 'lucide-react';
import { animalData, plantData, waterData } from '../../data';
import type { WildlifeEntry } from '../../types/wildlife';
import type { Circle } from '../../services/communitiesApi';

export const CIRCLE_ICON: Record<Circle['category'], LucideIcon> = { animal: PawPrint, plant: Sprout, water: Droplets };

export const catalogFor = (category: Circle['category']): WildlifeEntry[] =>
  category === 'animal' ? animalData : category === 'plant' ? plantData : waterData;

export const memberLabel = (count: number) =>
  count === 0 ? 'No members yet' : `${count.toLocaleString()} ${count === 1 ? 'member' : 'members'}`;
