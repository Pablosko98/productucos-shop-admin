import { Text } from '@/components/ui/text';
import * as React from 'react';
import { ScrollView, View, Image } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { supabase } from '@/util/supabase';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Product {
  id: string;
  name: string;
  image_path: string;
  last_verified_at: string | null;
  [key: string]: any;
}

export default function ManageInventory() {
  const { id: shopId, name } = useLocalSearchParams();
  const [loading, setLoading] = React.useState(false);
  const [assignedProducts, setAssignedProducts] = React.useState<Product[]>([]);
  const [remainingProducts, setRemainingProducts] = React.useState<Product[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [undoInStockCache, setUndoInStockCache] = React.useState<{ [id: string]: string | null }>(
    {}
  );

  if (!shopId) return <Text>No shop selected</Text>;

  const calculateLastVerified = (timestamp: string) => {
    const lastVerifiedDate = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - lastVerifiedDate.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return `${diffInSeconds} seconds ago`;
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 2592000) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 31536000) {
      const months = Math.floor(diffInSeconds / 2592000);
      return `${months} month${months > 1 ? 's' : ''} ago`;
    } else {
      const years = Math.floor(diffInSeconds / 31536000);
      return `${years} year${years > 1 ? 's' : ''} ago`;
    }
  };

  const fetchProducts = useCallback(async () => {
    if (!shopId) return;

    setLoading(true);
    setError(null);

    try {
      // 1️⃣ Fetch products assigned to this shop
      const { data: shopProducts, error: shopProductsError } = await supabase
        .from('shop_products')
        .select('*, product:products(*)')
        .eq('shop_id', shopId);

      if (shopProductsError) throw shopProductsError;

      const assigned: Product[] =
        shopProducts?.map((sp) => ({ ...sp.product, last_verified_at: sp.last_verified_at })) ?? [];
      setAssignedProducts(assigned);

      // 2️⃣ Fetch remaining products
      const assignedIds = assigned.map((p) => p.id);
      console.log('Assigned products:', assigned);
      let remaining: Product[] = [];

      if (assignedIds.length > 0) {
        const { data: remainingData, error: remainingError } = await supabase
          .from('products')
          .select('*')
          .not('id', 'in', `(${assignedIds.join(',')})`);

        if (remainingError) throw remainingError;
        remaining = remainingData ?? [];
      } else {
        const { data: allProducts, error: allError } = await supabase.from('products').select('*');

        if (allError) throw allError;
        remaining = allProducts ?? [];
      }

      setRemainingProducts(remaining);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  }, [shopId]);
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleRemove = async (product: Product) => {
    console.log(`Removing product ${product.id} from shop ${shopId}`);
    const { error } = await supabase
      .from('shop_products')
      .delete()
      .eq('product_id', product.id)
      .eq('shop_id', shopId);

    if (error) {
      console.error('Failed to remove product from inventory:', error);
    } else {
      // Clear any undo cache for this product since it's removed
      setUndoInStockCache((prev) => {
        const newCache = { ...prev };
        delete newCache[product.id];
        return newCache;
      });
      // Move product back to remainingProducts just in the UI without refetching
      setAssignedProducts((prev) => prev.filter((p) => p.id !== product.id));
      setRemainingProducts((prev) => [...prev, product]);
    }
  };
  const handleInStock = async (product: Product) => {
    console.log(`Marking product ${product.name} as in stock for shop ${shopId}`);
    const now = new Date().toISOString();
    setUndoInStockCache((prev) => ({ ...prev, [product.id]: product.last_verified_at }));

    // Update local state immediately
    setAssignedProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, last_verified_at: now } : p))
    );

    const { error } = await supabase
      .from('shop_products')
      .update({ last_verified_at: now })
      .eq('product_id', product.id)
      .eq('shop_id', shopId);

    if (error) {
      console.error('Failed to update', error);
      // rollback locally
      setAssignedProducts((prev) =>
        prev.map((p) =>
          p.id === product.id ? { ...p, last_verified_at: undoInStockCache[product.id] } : p
        )
      );
    }
  };
  const handleStockUndo = async (product: Product) => {
    console.log(`Undoing stock status for product ${product.id} in shop ${shopId}`);
    const prevValue = undoInStockCache[product.id];
    setAssignedProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, last_verified_at: prevValue } : p))
    );

    // Remove from cache
    setUndoInStockCache((prev) => {
      const newCache = { ...prev };
      delete newCache[product.id];
      return newCache;
    });

    const { error } = await supabase
      .from('shop_products')
      .update({ last_verified_at: prevValue })
      .eq('product_id', product.id)
      .eq('shop_id', shopId);

    if (error) {
      console.error('Failed to undo', error);
    }
  };
  const handleOutOfStock = async (productId: string) => {
    console.log(`Marking product ${productId} as out of stock for shop ${shopId}`);
  };
  const handleAddToInventory = async (product: Product) => {
    console.log(`Adding product ${product.id} to inventory for shop ${shopId}`);
    const { error } = await supabase.from('shop_products').insert({
      shop_id: shopId,
      product_id: product.id,
      last_verified_at: new Date().toISOString(),
    });
    if (error) {
      console.error('Failed to add product to inventory:', error);
    } else {
      // move product from remainingProducts to assignedProducts just in the UI without refetching
      setAssignedProducts((prev) => [
        ...prev,
        { ...product, last_verified_at: new Date().toISOString() },
      ]);
      setRemainingProducts((prev) => prev.filter((p) => p.id !== product.id));
    }
  };
  return (
    <SafeAreaView className="flex-1" style={{ padding: 16 }}>
      <Text className="mb-4 text-2xl font-bold">Manage Inventory for {name}</Text>
      <ScrollView>
        {loading ? (
          <Text>Loading...</Text>
        ) : error ? (
          <Text className="text-red-500">{error}</Text>
        ) : (
          <View>
            <Text className="mb-2 text-xl font-semibold">Assigned Products</Text>
            {assignedProducts.length === 0 ? (
              <Text>No products assigned to this shop.</Text>
            ) : (
              assignedProducts.map((product) => {
                const isStockUndoable = undoInStockCache[product.id] !== undefined;
                return (
                  <Card key={product.id} className="mb-2">
                    <CardHeader>
                      <Text>{product.name}</Text>
                      <View
                        style={{
                          display: 'flex',
                          flexDirection: 'row',
                          gap: 4,
                        }}>
                        <AspectRatio
                          ratio={1}
                          className="w-20"
                          style={{
                            backgroundColor: 'white',
                            justifyContent: 'center',
                            alignItems: 'center',
                            borderRadius: 8,
                          }}>
                          <Image
                            source={{
                              uri: `https://mljdghhebfkxyjmlotks.supabase.co/storage/v1/object/public/product_images/${product.image_path}`,
                            }}
                            style={{
                              width: 50,
                              height: 50,
                              resizeMode: 'contain',
                            }}
                          />
                        </AspectRatio>
                        <Text>
                          Last verified: {calculateLastVerified(product.last_verified_at)}
                        </Text>
                      </View>
                    </CardHeader>
                    <CardContent
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingVertical: 8,
                      }}>
                      {/* Buttons */}
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Button
                          onPress={() => handleRemove(product)}
                          style={{ backgroundColor: '#f87171', paddingHorizontal: 8 }}>
                          <Text style={{ color: 'white' }}>Remove</Text>
                        </Button>

                        <Button
                          onPress={() => handleOutOfStock(product.id)}
                          style={{ backgroundColor: '#fbbf24', paddingHorizontal: 8 }}>
                          <Text style={{ color: 'white' }}>Out of stock</Text>
                        </Button>

                        {isStockUndoable ? (
                          <Button
                            onPress={() => handleStockUndo(product)}
                            style={{ backgroundColor: 'grey', paddingHorizontal: 8 }}>
                            <Text style={{ color: 'white' }}>Undo</Text>
                          </Button>
                        ) : (
                          <Button
                            onPress={() => handleInStock(product)}
                            style={{ backgroundColor: '#34d399', paddingHorizontal: 8 }}>
                            <Text style={{ color: 'white' }}>In stock</Text>
                          </Button>
                        )}
                      </View>
                    </CardContent>
                  </Card>
                );
              })
            )}

            <Text className="mb-2 mt-4 text-xl font-semibold">Available Products</Text>
            {remainingProducts.length === 0 ? (
              <Text>All products are assigned to this shop.</Text>
            ) : (
              remainingProducts.map((product) => (
                <Card key={product.id} className="mb-2">
                  <CardHeader>
                    <Text>{product.name}</Text>
                    <View style={{ marginRight: 12 }}>
                      <AspectRatio
                        ratio={1}
                        className="w-20"
                        style={{
                          backgroundColor: 'white',
                          justifyContent: 'center',
                          alignItems: 'center',
                          borderRadius: 8,
                        }}>
                        <Image
                          source={{
                            uri: `https://mljdghhebfkxyjmlotks.supabase.co/storage/v1/object/public/product_images/${product.image_path}`,
                          }}
                          style={{
                            width: 50,
                            height: 50,
                            resizeMode: 'contain',
                          }}
                        />
                      </AspectRatio>
                    </View>
                  </CardHeader>
                  <CardContent
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingVertical: 8,
                    }}>
                    {/* Buttons */}
                    <Button
                      onPress={() => handleAddToInventory(product)}
                      style={{ backgroundColor: '#34d399', paddingHorizontal: 8 }}>
                      <Text style={{ color: 'white' }}>Add to inventory</Text>
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
