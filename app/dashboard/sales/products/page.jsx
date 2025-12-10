"use client";

import { Package, Plus, Edit, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const mockProducts = [
  { id: "PROD-001", name: "Sugarcane Juice", price: 3.80, category: "Beverages", status: "active", stock: 500 },
  { id: "PROD-002", name: "Sugarcane Juice (Large)", price: 5.00, category: "Beverages", status: "active", stock: 300 },
  { id: "PROD-003", name: "Sugarcane with Lemon", price: 4.20, category: "Beverages", status: "inactive", stock: 0 },
];

export default function ProductManagementPage() {
  const activeProducts = mockProducts.filter(p => p.status === "active").length;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background px-6">
        <div>
          <h1 className="text-xl font-semibold">Product Management</h1>
          <p className="text-sm text-muted-foreground">
            {activeProducts} active products
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Product
        </Button>
      </header>

      <main className="p-6">
        {/* Product Cards Overview */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          {mockProducts.filter(p => p.status === "active").map((product) => (
            <Card key={product.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{product.name}</CardTitle>
                  <Badge variant="success">Active</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">SGD {product.price.toFixed(2)}</span>
                  <span className="text-sm text-muted-foreground">{product.stock} in stock</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Products Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4" />
              All Products
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-mono">{product.id}</TableCell>
                    <TableCell>{product.name}</TableCell>
                    <TableCell>SGD {product.price.toFixed(2)}</TableCell>
                    <TableCell>{product.category}</TableCell>
                    <TableCell>
                      <Badge variant={product.status === "active" ? "success" : "secondary"}>
                        {product.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{product.stock}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
