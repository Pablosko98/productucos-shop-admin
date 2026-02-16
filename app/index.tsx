import { Text } from '@/components/ui/text';
import * as React from 'react';
import { MapView, Camera, UserLocation, PointAnnotation } from "@maplibre/maplibre-react-native";
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { Dimensions, TouchableOpacity, View, ScrollView, RefreshControl } from 'react-native';
import { supabase } from '@/util/supabase';
import { Card, CardHeader, CardContent } from '@/components/ui/card';

type Shop = {
  id: string;
  name: string;
  coords: [number, number];
}

export default function Screen() {
const [shops, setShops] = useState<Shop[]>([])
const [userCoords, setUserCoords] = useState<[number, number] | null>(null)
const [selectedShop, setSelectedShop] = useState<Shop | null>(null)
const [refreshing, setRefreshing] = useState(false);
const cameraRef = useRef<Camera>(null);
const screenHeight = Dimensions.get('window').height;
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') return
      
      
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      })
      console.log(loc)

      setUserCoords([loc.coords.longitude, loc.coords.latitude])
    })()
  }, [])
  // Get shops from supabase
  useEffect(() => {
    (async () => {
      const { data: shops, error } = await supabase.from('shops').select('*')
      if (error) {
        console.error(error)
        return
      }
      setShops(shops.map((shop) => ({
        id: shop.id,
        name: shop.name,
        coords: [shop.longitude, shop.latitude],
      })))
    })()
  }, [])
  const handleShopSelect = (shop: Shop) => {
    console.log('Selected shoppp:', shop);
    setSelectedShop(shop);
    cameraRef.current?.setCamera({
      centerCoordinate: shop.coords,
      zoomLevel: 20,
      animationDuration: 1000,
    });
  }
  return (
    <View>
      <TouchableOpacity onPress={() => {
          if (userCoords) {
            cameraRef.current?.setCamera({
              centerCoordinate: userCoords,
              zoomLevel: 16,
              animationDuration: 1000,
            });
              setSelectedShop(null);
          }
      }}>
        <Text className='text-lg font-bold mb-4'>Center map</Text>
      </TouchableOpacity>
    <MapView
      style={{ height: screenHeight * 0.4, borderRadius: 10, overflow: 'hidden' }}
      mapStyle="https://api.maptiler.com/maps/streets-v2/style.json?key=9lKcz3dnis2TfSC9jJ8n"
    >
      {userCoords && (
        <Camera
        ref={cameraRef}
          zoomLevel={16}
          animationDuration={1000}
          followUserLocation={true}
        />
      )}
      <UserLocation visible={true} onUpdate={(location) => {
    setUserCoords(location.coords
      ? [location.coords.longitude, location.coords.latitude]
      : null
    );
  }} />
       {shops.map((shop) => (
          <PointAnnotation
            key={shop.id}
            id={shop.id}
            coordinate={shop.coords}
            onSelected={() => handleShopSelect(shop)}
          >
            <View >
              <Text style={{ color: 'black', fontWeight: 'bold' }}>{shop.name}</Text>
            </View>
          </PointAnnotation>
        ))}
      </MapView>
      <ScrollView style={{ maxHeight: screenHeight * 0.5, marginTop: 20 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 1000);
      }}/>}>
      {shops.length > 0 && (
        shops.map((shop) => (
            <TouchableOpacity key={shop.id} onPress={() => {
              // cameraRef.current?.setCamera({
              //   centerCoordinate: shop.coords,
              //   zoomLevel: 16,
              //   animationDuration: 1000,
              // });
              handleShopSelect(shop);
            }}>
          <Card className='mt-4' style={{ backgroundColor: selectedShop?.id === shop.id ? 'grey' : 'transparent', borderWidth: 2 }}>
            <CardHeader>
              <Text className='text-lg font-bold'>{shop.name}</Text>
            </CardHeader>
            {selectedShop?.id === shop.id && <CardContent>
              <Text>Shop description</Text>
            </CardContent>}
          </Card>
          </TouchableOpacity>
        ))
      )}
      </ScrollView>
    </View>
  );
}
