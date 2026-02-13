"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import {
  TrendingUp,
  RefreshCw,
  Sparkles,
  Package,
  ShoppingCart,
  Calculator,
  Calendar,
  Save,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export default function StockPredictionPage() {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [predictionsMap, setPredictionsMap] = useState({});
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [stockLeftInput, setStockLeftInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/stock-prediction?days=14");
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch data");
      }

      // Store predictions map
      const pMap = data.predictionsMap || {};
      setPredictionsMap(pMap);

      const latestPredDate = data.latestPrediction?.predictDate;

      const transformed = data.historicalData.map((day) => {
        const pred = pMap[day.date];
        return {
          date: formatDate(day.date),
          fullDate: day.date,
          sold: day.sold,
          predicted: pred ? pred.totalPredicted : null,
          left: pred?.stockLeft || null,
        };
      });

      // If latest prediction date is not in historical data, add it
      if (data.latestPrediction) {
        const lastHistDate = data.historicalData[data.historicalData.length - 1]?.date;
        if (latestPredDate > lastHistDate) {
          transformed.push({
            date: formatDate(latestPredDate),
            fullDate: latestPredDate,
            sold: null,
            predicted: data.latestPrediction.totalPredicted,
            left: data.latestPrediction.stockLeft || null,
          });
        }

        setPrediction({
          value: data.latestPrediction.totalPredicted,
          date: latestPredDate,
          machines: data.latestPrediction.machines,
          stockLeft: data.latestPrediction.stockLeft,
        });

        // Set default selected date to latest prediction
        if (!selectedDate) {
          setSelectedDate(latestPredDate);
          setStockLeftInput(data.latestPrediction.stockLeft?.toString() || "");
        }
      }

      setChartData(transformed);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  // Handle date selection change
  function handleDateChange(e) {
    const date = e.target.value;
    setSelectedDate(date);
    setSaveMessage(null);

    // Load existing stock left for this date
    const pred = predictionsMap[date];
    if (pred) {
      setStockLeftInput(pred.stockLeft?.toString() || "");
    } else {
      setStockLeftInput("");
    }
  }

  // Save stock left for selected date
  async function handleSaveStockLeft() {
    if (!selectedDate || stockLeftInput === "") {
      setSaveMessage({ type: "error", text: "Please select a date and enter stock left" });
      return;
    }

    try {
      setSaving(true);
      setSaveMessage(null);

      const res = await fetch("/api/stock-prediction", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          stockLeft: parseInt(stockLeftInput, 10),
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to save");
      }

      setSaveMessage({ type: "success", text: "Saved!" });

      // Refresh data to update chart
      await fetchData();
    } catch (err) {
      console.error("Error saving stock left:", err);
      setSaveMessage({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  // Get available dates from predictions (dates that have predictions)
  const availableDates = Object.keys(predictionsMap).sort();

  // Calculate buy amount based on selected date
  const selectedPred = predictionsMap[selectedDate];
  const leftValue = parseInt(stockLeftInput) || 0;
  const predictedValue = selectedPred?.totalPredicted || prediction?.value || 0;
  const buyAmount = Math.max(0, predictedValue - leftValue);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-background shrink-0">
        <div className="flex h-14 md:h-16 items-center justify-between px-4 md:px-6">
          <div>
            <h1 className="text-lg md:text-xl font-semibold">Stock Prediction</h1>
            <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
              ML-powered sales forecasting (auto-runs daily at 23:59 SGT)
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 md:mr-2 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden md:inline">Refresh</span>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 md:p-6">
        {error && (
          <Card className="mb-4 border-red-200 bg-red-50">
            <CardContent className="p-4">
              <p className="text-red-600 text-sm">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Chart Section */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5" />
              Daily Sales Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80 md:h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Legend />
                  <Bar
                    dataKey="sold"
                    name="Sold"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="predicted"
                    name="Predicted"
                    fill="#f59e0b"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="left"
                    name="Left"
                    fill="#22c55e"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Showing last 14 days of sales + next day prediction
            </p>
          </CardContent>
        </Card>

        {/* Update Stock Left Section */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-5 w-5" />
              Update Stock Left
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Date</label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={handleDateChange}
                  className="w-48"
                  min={availableDates[0]}
                  max={availableDates[availableDates.length - 1]}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Stock Left</label>
                <Input
                  type="number"
                  value={stockLeftInput}
                  onChange={(e) => setStockLeftInput(e.target.value)}
                  placeholder="Enter stock left"
                  className="w-32"
                  min="0"
                />
              </div>
              <Button onClick={handleSaveStockLeft} disabled={saving || !selectedDate}>
                <Save className={`h-4 w-4 mr-2 ${saving ? "animate-spin" : ""}`} />
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
            {saveMessage && (
              <p className={`text-sm mt-2 ${saveMessage.type === "error" ? "text-red-600" : "text-green-600"}`}>
                {saveMessage.text}
              </p>
            )}
            {!selectedPred && selectedDate && (
              <p className="text-sm text-muted-foreground mt-2">
                No prediction exists for this date.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Predicted Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Predicted Sales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600">
                {predictedValue || "-"}
              </div>
              {selectedDate && selectedPred && (
                <div className="text-xs text-muted-foreground mt-1">
                  <p>For {formatDate(selectedDate)}</p>
                </div>
              )}
              {!selectedPred && prediction && (
                <div className="text-xs text-muted-foreground mt-1">
                  <p>For {formatDate(prediction.date)} ({prediction.machines} machines)</p>
                </div>
              )}
              {!prediction && !selectedPred && (
                <p className="text-xs text-muted-foreground mt-1">
                  No prediction yet. Runs daily at 23:59 SGT.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Left Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Package className="h-4 w-4 text-green-500" />
                Stock Left
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {leftValue || "-"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedDate ? `For ${formatDate(selectedDate)}` : "Select a date below"}
              </p>
            </CardContent>
          </Card>

          {/* Buy Card */}
          <Card className={buyAmount > 0 ? "border-blue-200 bg-blue-50" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <ShoppingCart className="h-4 w-4 text-blue-500" />
                Recommended Purchase
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">=</span>
                <span className={`text-3xl font-bold ${buyAmount > 0 ? "text-blue-600" : "text-gray-400"}`}>
                  {selectedPred || prediction ? buyAmount : "-"}
                </span>
              </div>
              {(selectedPred || prediction) && (
                <p className="text-xs text-muted-foreground mt-1">
                  {buyAmount > 0
                    ? `Need ${buyAmount} more units (${predictedValue} - ${leftValue})`
                    : "Stock is sufficient for predicted demand"}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
