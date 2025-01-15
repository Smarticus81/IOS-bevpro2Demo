import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import type { Drink } from '@db/schema';

interface UpdateInventoryParams {
  drinkId: number;
  quantity: number;
  isIncrement?: boolean;
}

export function useInventoryManager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateInventory = async ({ drinkId, quantity, isIncrement = false }: UpdateInventoryParams) => {
    // Get the current drinks data from the cache
    const currentData = queryClient.getQueryData<{ drinks: Drink[] }>(['/api/drinks']);
    const currentDrink = currentData?.drinks.find(d => d.id === drinkId);

    if (!currentDrink) {
      throw new Error('Drink not found in cache');
    }

    // Calculate new inventory
    const newInventory = isIncrement 
      ? currentDrink.inventory + quantity 
      : currentDrink.inventory - quantity;

    if (newInventory < 0) {
      throw new Error('Insufficient inventory');
    }

    // Optimistically update the cache
    queryClient.setQueryData<{ drinks: Drink[] }>(['/api/drinks'], (old) => {
      if (!old) return { drinks: [] };
      return {
        drinks: old.drinks.map(drink => 
          drink.id === drinkId 
            ? { ...drink, inventory: newInventory }
            : drink
        )
      };
    });

    try {
      // Make API call to update inventory
      const response = await fetch(`/api/drinks/${drinkId}/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          quantity,
          isIncrement
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update inventory');
      }

      // Show success toast
      toast({
        title: "Inventory Updated",
        description: `${currentDrink.name} inventory ${isIncrement ? 'increased' : 'decreased'} by ${quantity}`,
      });

      // Refetch to ensure consistency
      await queryClient.invalidateQueries({ queryKey: ['/api/drinks'] });

      return true;
    } catch (error) {
      // Revert optimistic update on error
      queryClient.setQueryData<{ drinks: Drink[] }>(['/api/drinks'], currentData);

      // Show error toast
      toast({
        title: "Error Updating Inventory",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });

      return false;
    }
  };

  return {
    updateInventory
  };
}
