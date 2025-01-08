import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const addItemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  subcategory: z.string().optional(),
  price: z.string().min(1, "Price is required"),
  initialVolume: z.string().optional(),
  bottleId: z.string().optional(),
  taxCategoryId: z.string().optional(),
  inventory: z.string().optional(),
});

type AddItemFormValues = z.infer<typeof addItemSchema>;

const categories = [
  "Spirits",
  "Beer",
  "Wine",
  "Non-Alcoholic",
  "Classics",
  "Signature"
];

const taxCategories = [
  { id: "1", name: "Standard Liquor" },
  { id: "2", name: "Premium Liquor" },
  { id: "3", name: "Beer" },
  { id: "4", name: "Wine" },
  { id: "5", name: "Non-Alcoholic" }
];

interface AddInventoryItemProps {
  trigger?: React.ReactNode;
}

export function AddInventoryItem({ trigger }: AddInventoryItemProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<AddItemFormValues>({
    resolver: zodResolver(addItemSchema),
    defaultValues: {
      name: "",
      category: "",
      subcategory: "",
      price: "",
      initialVolume: "",
      bottleId: "",
      taxCategoryId: "",
      inventory: "",
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async (values: AddItemFormValues) => {
      const response = await fetch("/api/drinks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          category: values.category,
          subcategory: values.subcategory || null,
          price: parseFloat(values.price),
          initial_volume_ml: values.initialVolume ? parseInt(values.initialVolume) : null,
          bottle_id: values.bottleId || null,
          tax_category_id: values.taxCategoryId ? parseInt(values.taxCategoryId) : null,
          inventory: values.inventory ? parseInt(values.inventory) : 0,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drinks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pour-inventory"] });
      toast({
        title: "Success",
        description: "Item added successfully",
      });
      setOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const needsPourTracking = (category: string) => {
    return ["spirits", "classics", "signature"].includes(category.toLowerCase());
  };

  const onSubmit = (values: AddItemFormValues) => {
    try {
      if (!values.price || isNaN(parseFloat(values.price))) {
        toast({
          title: "Error",
          description: "Please enter a valid price",
          variant: "destructive",
        });
        return;
      }

      if (needsPourTracking(values.category)) {
        if (!values.initialVolume || !values.bottleId || !values.taxCategoryId) {
          toast({
            title: "Error",
            description: "Pour tracking items require volume, bottle ID, and tax category",
            variant: "destructive",
          });
          return;
        }
      }

      addItemMutation.mutate(values);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add item",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline">Add Item</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Item</DialogTitle>
          <DialogDescription>
            Add a new item to your inventory. Fill out the details below.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter item name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="subcategory"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subcategory (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter subcategory" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Enter price"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch("category") && needsPourTracking(form.watch("category")) ? (
              <>
                <FormField
                  control={form.control}
                  name="initialVolume"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Initial Volume (ml)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Enter initial volume"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bottleId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bottle ID</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter bottle ID" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="taxCategoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax Category</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select tax category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {taxCategories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            ) : (
              <FormField
                control={form.control}
                name="inventory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Initial Inventory</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Enter initial inventory count"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={addItemMutation.isPending}>
                {addItemMutation.isPending ? "Adding..." : "Add Item"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}