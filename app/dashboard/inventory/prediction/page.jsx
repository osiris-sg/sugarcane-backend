"use client";

export const dynamic = "force-dynamic";

import { TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function StockPredictionPage() {
  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-background shrink-0">
        <div className="flex h-14 md:h-16 items-center px-4 md:px-6">
          <div>
            <h1 className="text-lg md:text-xl font-semibold">Stock Prediction</h1>
            <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
              AI-powered stock forecasting
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <Card className="max-w-md mx-auto mt-12">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Coming Soon</h2>
            <p className="text-muted-foreground">
              Stock prediction features are currently under development.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
