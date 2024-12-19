import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavBar } from "@/components/NavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Package, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Drink } from "@db/schema";

interface Event {
  id: number;
  name: string;
  date: Date;
  inventory: {
    drinkId: number;
    allocated: number;
  }[];
}

export function Events() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<Event[]>([]);
  
  const { data: drinks = [] } = useQuery<Drink[]>({
    queryKey: ["/api/drinks"],
  });

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      
      <div className="container mx-auto p-4 lg:p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Event Management</h1>
          <p className="text-white/70">Schedule events and manage inventory allocation</p>
        </div>

        <div className="grid gap-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-white/90 backdrop-blur-md border-white/20 shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <CalendarIcon className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-sm text-gray-600">Upcoming Events</p>
                    <p className="text-2xl font-bold text-gray-900">{events.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/90 backdrop-blur-md border-white/20 shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <Package className="h-8 w-8 text-emerald-500" />
                  <div>
                    <p className="text-sm text-gray-600">Total Allocated</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {events.reduce((sum, event) => 
                        sum + event.inventory.reduce((total, inv) => total + inv.allocated, 0), 
                      0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/90 backdrop-blur-md border-white/20 shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <AlertTriangle className="h-8 w-8 text-yellow-500" />
                  <div>
                    <p className="text-sm text-gray-600">Low Stock Events</p>
                    <p className="text-2xl font-bold text-gray-900">0</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Calendar and Events List */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 bg-white/90 backdrop-blur-md border-white/20 shadow-xl">
              <CardHeader>
                <CardTitle>Calendar View</CardTitle>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  className="rounded-md border p-3"
                />
              </CardContent>
            </Card>

            <Card className="bg-white/90 backdrop-blur-md border-white/20 shadow-xl">
              <CardHeader>
                <CardTitle>Events</CardTitle>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full bg-gradient-to-b from-zinc-800 to-black text-white shadow-[0_4px_10px_rgba(0,0,0,0.3)] border border-white/10 backdrop-blur-sm hover:shadow-[0_6px_20px_rgba(0,0,0,0.4)] hover:from-zinc-700 hover:to-zinc-900 transition-all duration-300"
                >
                  Create New Event
                </Button>

                <div className="mt-4 space-y-4">
                  {events.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      No events scheduled
                    </div>
                  ) : (
                    events.map(event => (
                      <div key={event.id} className="p-4 border rounded-lg">
                        <div className="font-medium text-gray-900">{event.name}</div>
                        <div className="text-sm text-gray-600">
                          {event.date.toLocaleDateString()}
                        </div>
                        <div className="mt-2">
                          <Badge variant="secondary">
                            {event.inventory.length} items allocated
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
