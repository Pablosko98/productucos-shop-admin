import { Text } from '@/components/ui/text';
import * as React from 'react';
import {
  MapView,
  Camera,
  ShapeSource,
  SymbolLayer,
  Images,
  UserLocation,
} from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Dimensions, TouchableOpacity, View, ScrollView, RefreshControl } from 'react-native';
import { supabase } from '@/util/supabase';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import type { FeatureCollection, Point } from 'geojson';
import { Button } from '@/components/ui/button';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

type Shop = {
  id: string;
  name: string;
  coords: [number, number];
  hours: ShopHours[];
};

type ShopHours = {
  open_time: string;
  close_time: string;
  day_of_week: number;
};

export default function Screen() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);
  const [selectedShop, setSelectedShop] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const cameraRef = useRef<Camera>(null);
  const screenHeight = Dimensions.get('window').height;
  const shopFeatures = React.useMemo<FeatureCollection<Point>>(
    () => ({
      type: 'FeatureCollection',
      features: shops.map((shop) => ({
        type: 'Feature',
        id: shop.id,
        properties: {
          name: shop.name,
        },
        geometry: {
          type: 'Point',
          coordinates: shop.coords, // [lng, lat]
        },
      })),
    }),
    [shops]
  );

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setUserCoords([loc.coords.longitude, loc.coords.latitude]);
    })();
  }, []);
  // Get shops from supabase
  const fetchShops = useCallback(async () => {
    const { data, error } = await supabase.from('shops').select('*, hours:shop_hours(*)');

    if (error) {
      console.error(error);
      return;
    }

    setShops(
      data.map((shop) => ({
        id: shop.id,
        name: shop.name,
        coords: [shop.longitude, shop.latitude] as [number, number],
        hours: shop.hours.map((h: ShopHours) => ({
          open_time: h.open_time.slice(0, 5), // Format as HH:MM
          close_time: h.close_time.slice(0, 5), // Format as HH:MM
          day_of_week: h.day_of_week,
        })),
      }))
    );
  }, []);
  useEffect(() => {
    fetchShops();
  }, [fetchShops]);
  const handleShopSelect = (shopId: string) => {
    const shop = shops.find((s) => s.id === shopId);
    if (!shop) return;
    setSelectedShop(shopId);
    cameraRef.current?.setCamera({
      centerCoordinate: shop.coords,
      zoomLevel: 16,
      animationDuration: 1000,
    });
  };
  const [hasCenteredOnUser, setHasCenteredOnUser] = useState(false);
  useEffect(() => {
    if (userCoords && !hasCenteredOnUser) {
      cameraRef.current?.setCamera({
        centerCoordinate: userCoords,
        zoomLevel: 16,
        animationDuration: 1000,
      });
      setHasCenteredOnUser(true);
    }
  }, [userCoords, hasCenteredOnUser]);
  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <TouchableOpacity
        onPress={() => {
          if (userCoords) {
            cameraRef.current?.setCamera({
              centerCoordinate: userCoords,
              zoomLevel: 14,
              animationDuration: 1000,
            });
            setSelectedShop(null);
          }
        }}>
        <Text className="mb-4 text-lg font-bold">Center map</Text>
      </TouchableOpacity>
      <MapView
        style={{ height: screenHeight * 0.4, borderRadius: 10, overflow: 'hidden' }}
        mapStyle="https://api.maptiler.com/maps/streets-v2/style.json?key=9lKcz3dnis2TfSC9jJ8n">
        <Camera ref={cameraRef} />
        <Images images={{ superMarket: require('../assets/images/supermarket.png') }} />
        <UserLocation
          visible={true}
          onUpdate={(location) => {
            setUserCoords(
              location.coords ? [location.coords.longitude, location.coords.latitude] : null
            );
          }}
        />
        <ShapeSource
          id="shopsSource"
          shape={shopFeatures}
          onPress={(e) => {
            const feature = e.features[0];
            feature && handleShopSelect(feature.id?.toString() || '');
          }}>
          <SymbolLayer
            id="shopsLayer"
            style={{
              iconImage: 'superMarket',
              iconSize: 0.25,
              textField: ['get', 'name'],
              textSize: 12,
              textOffset: [0, 1.5],
              textAnchor: 'top',
              textColor: '#000',
              textHaloColor: '#fff',
              textHaloWidth: 1,
            }}
          />
        </ShapeSource>
      </MapView>
      <ScrollView
        style={{ maxHeight: screenHeight * 0.5, marginTop: 20 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchShops().then(() => setRefreshing(false));
            }}
          />
        }>
        {shops.length > 0 &&
          shops.map((shop) => {
            const hoursToday =
              shop.hours
                .filter((h) => h.day_of_week === new Date().getDay())
                .map((h) => `${h.open_time} - ${h.close_time}`)
                .join(', ') || null;
            return (
              <TouchableOpacity
                key={shop.id}
                onPress={() => {
                  handleShopSelect(shop.id);
                }}>
                <Card
                  className="mt-4"
                  style={{
                    backgroundColor: selectedShop === shop.id ? 'grey' : 'transparent',
                    borderWidth: 2,
                  }}>
                  <CardHeader>
                    <Text className="text-lg font-bold">{shop.name}</Text>
                    <Text>{hoursToday ? `Open today: ${hoursToday}` : 'Closed today'}</Text>
                  </CardHeader>
                  {selectedShop === shop.id && (
                    <CardContent style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                      <Button>
                        <Text>Edit shop</Text>
                      </Button>
                      <Button
                        onPress={() => {
                          router.navigate({
                            pathname: `/manage_inventory/[id]`,
                            params: { id: shop.id, name: shop.name },
                          });
                        }}>
                        <Text>Manage inventory</Text>
                      </Button>
                    </CardContent>
                  )}
                </Card>
              </TouchableOpacity>
            );
          })}
      </ScrollView>
    </SafeAreaView>
  );
}
