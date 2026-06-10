/**
 * ChadMap Component
 * 
 * Interactive map of Chad's 23 provinces using React-Leaflet.
 * Supports two modes:
 * - "insight": For Researcher dashboard - shows demographic data popup
 * - "audit": For Analyst dashboard - colors provinces Red/Green based on Quality Gate
 * 
 * Features:
 * - Strict bounds locked to Chad
 * - Donut Masking to hide non-Chad areas
 * - High-fidelity Satellite/Street/Hybrid layers
 * - Z-index management for sidebar compatibility
 * 
 * Uses WGS84 (EPSG:4326) coordinate system.
 */
import { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON, LayersControl } from 'react-leaflet';
import { Layer, LeafletMouseEvent } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useMap } from 'react-leaflet';
import { API_URL } from '@/services/api';

// Types
interface Province {
    region_id: string;
    name: string;
    name_fr: string;
    capital: string;
    density?: number;
}

interface GeoJSONFeature {
    type: 'Feature';
    id: string;
    properties: Province;
    geometry: {
        type: string;
        coordinates: number[][][];
    };
}

interface GenderStat {
    name: string;
    value: number;
    percentage: number;
}

interface AgeStat {
    age_group: string;
    population: number;
    percentage: number;
}

interface RegionStats {
    region_id: string;
    province_name: string;
    province_name_fr: string;
    capital: string;
    gender_stats: GenderStat[];
    age_stats: AgeStat[];
    data_source: string;
}

interface QualityData {
    region_id: string;
    quality_score: number;
    passed_quality_gate: boolean;
    color: 'green' | 'red';
    errors?: { type: string; message: string }[];
}

interface ChadMapProps {
    mode: 'insight' | 'audit';
    year?: number;
    onProvinceClick?: (regionId: string, provinceName: string) => void;
    onStatsUpdate?: (stats: RegionStats | null) => void;
    onLoadingChange?: (loading: boolean) => void;
    disableInteraction?: boolean;
    collapsed?: boolean;
}

// Component to handle map resizing when sidebar toggles
function MapResizer({ collapsed }: { collapsed?: boolean }) {
    const map = useMap();
    useEffect(() => {
        const timer = setTimeout(() => {
            map.invalidateSize();
        }, 300);
        return () => clearTimeout(timer);
    }, [map, collapsed]);
    return null;
}

// API base URL
const API_BASE = `${API_URL}/api/v1/spatial`;

export default function ChadMap({ mode, year = 2009, onProvinceClick, onStatsUpdate, onLoadingChange, collapsed }: ChadMapProps) {
    const { t, isRtl } = useLanguage();
    const { loading: authLoading } = useAuth();
    const [geoData, setGeoData] = useState<GeoJSONFeature[] | null>(null);
    const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
    const [qualityData, setQualityData] = useState<Record<string, QualityData>>({});
    const [isMapLoading, setIsMapLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Sync loadings to parent
    useEffect(() => {
        onLoadingChange?.(isMapLoading || statsLoading);
    }, [isMapLoading, statsLoading, onLoadingChange]);

    // Fetch GeoJSON data on mount
    useEffect(() => {
        if (authLoading) return;

        const fetchGeoJSON = async () => {
            try {
                const token = sessionStorage.getItem('authToken');
                if (!token) return;

                const response = await fetch(`${API_BASE}/geojson`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (!response.ok) throw new Error('Failed to load map data');

                const data = await response.json();
                setGeoData(data.features);
                setIsMapLoading(false);
            } catch (err) {
                setError('Failed to load map data. Please try again.');
                setIsMapLoading(false);
            }
        };

        fetchGeoJSON();
    }, [authLoading]);

    // Fetch Quality Data for Audit Mode
    useEffect(() => {
        if (mode !== 'audit' || authLoading) return;
        const fetchQualityData = async () => {
            try {
                const token = sessionStorage.getItem('authToken');
                if (!token) return;
                const response = await fetch(`${API_BASE}/quality/all`, { headers: { Authorization: `Bearer ${token}` } });
                if (!response.ok) throw new Error('Failed');
                const data = await response.json();
                const qualityMap: Record<string, QualityData> = {};
                data.provinces.forEach((p: QualityData) => { qualityMap[p.region_id] = p; });
                setQualityData(qualityMap);
            } catch (err) { console.error(err); }
        };
        fetchQualityData();
    }, [mode, authLoading]);

    // Fetch Stats for clicked province
    const fetchRegionStats = useCallback(async (regionId: string, provinceName: string) => {
        setStatsLoading(true);
        onStatsUpdate?.(null);
        try {
            const token = sessionStorage.getItem('authToken');
            let endpoint = mode === 'audit' 
                ? `${API_BASE}/quality?region_id=${regionId}&year=${year}` 
                : `${API_BASE}/stats/${encodeURIComponent(provinceName.trim())}?year=${year}`;
            
            const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
            if (!response.ok) throw new Error('Failed');
            const data = await response.json();
            onStatsUpdate?.(data);
        } catch (err) { console.error(err); } finally { setStatsLoading(false); }
    }, [mode, onStatsUpdate, year]);

    // Feature Styles (Chloropleth/Audit)
    const getFeatureStyle = useCallback((feature?: GeoJSONFeature) => {
        if (!feature) return {};
        const regionId = feature.id || feature.properties.region_id;
        const isSelected = selectedRegion === regionId;
        const quality = qualityData[regionId as string];

        if (mode === 'audit') {
            const isPassed = quality?.passed_quality_gate;
            const borderColor = isPassed ? '#10b981' : '#f59e0b';
            return {
                fillColor: borderColor,
                fillOpacity: 0.2,
                weight: isSelected ? 4 : 2,
                opacity: 1,
                color: isSelected ? '#4f46e5' : borderColor,
                dashArray: '',
            };
        }

        return {
            fillColor: isSelected ? '#334155' : '#10b981',
            fillOpacity: isSelected ? 0.9 : 0.2,
            weight: isSelected ? 3 : 2,
            opacity: 1,
            color: isSelected ? '#0f172a' : '#10b981',
            dashArray: '',
        };
    }, [mode, selectedRegion, qualityData]);

    const onEachFeature = useCallback((feature: GeoJSONFeature, layer: Layer) => {
        layer.on({
            mouseover: (e: LeafletMouseEvent) => {
                const target = e.target;
                const regionId = feature.id || feature.properties.region_id;
                const quality = qualityData[regionId as string];
                const hoverColor = mode === 'audit'
                    ? (quality?.passed_quality_gate ? '#10b981' : '#f59e0b')
                    : '#4f46e5';

                target.setStyle({
                    weight: 3,
                    fillOpacity: 0.4,
                    color: hoverColor
                });
                target.bringToFront();
            },
            mouseout: (e: LeafletMouseEvent) => {
                const target = e.target;
                const regionId = feature.id || feature.properties.region_id;
                if (regionId !== selectedRegion) {
                    target.setStyle(getFeatureStyle(feature));
                }
            },
            click: (e: LeafletMouseEvent) => {
                const regionId = feature.id || feature.properties.region_id;
                const provinceName = feature.properties.name;
                setSelectedRegion(regionId as string);
                
                localStorage.setItem('selectedProvince', provinceName);
                window.dispatchEvent(new Event('storage'));

                const map = e.target._map;
                map.setView(e.latlng, map.getZoom(), { animate: true });
                setTimeout(() => {
                    const offset = map.getSize().x * 0.15;
                    map.panBy([offset, 0], { animate: true });
                }, 100);

                fetchRegionStats(regionId, provinceName);
                onProvinceClick?.(regionId, provinceName);
            },
        });
    }, [selectedRegion, getFeatureStyle, fetchRegionStats, onProvinceClick, qualityData, mode]);

    if (isMapLoading) return (
        <div className="flex justify-center items-center h-full">
            <div className="animate-spin h-8 w-8 border-2 border-primary rounded-full border-t-transparent" />
        </div>
    );
    
    if (error) return <div className="text-destructive p-4 text-center font-bold">{error}</div>;

    return (
        <div className={`relative w-full h-full overflow-hidden ${isRtl ? 'rtl' : 'ltr'}`}>
            <MapContainer
                center={[15.45, 18.73]}
                zoom={6}
                minZoom={3}
                maxZoom={18}
                style={{ height: '100%', width: '100%', background: 'transparent', zIndex: 1 }}
                scrollWheelZoom={true}
                attributionControl={false}
            >
                <MapResizer collapsed={collapsed} />
                
                <LayersControl position="bottomleft">
                    <LayersControl.BaseLayer checked name="OpenStreetMap">
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    </LayersControl.BaseLayer>
                    <LayersControl.BaseLayer name="Satellite">
                        <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                    </LayersControl.BaseLayer>
                </LayersControl>

                {geoData && (
                    <GeoJSON
                        key={`${mode}-${JSON.stringify(qualityData)}-${isRtl}`}
                        data={{ type: 'FeatureCollection', features: geoData } as any}
                        style={getFeatureStyle as any}
                        onEachFeature={onEachFeature as any}
                    />
                )}
            </MapContainer>

            <style dangerouslySetInnerHTML={{
                __html: `
                .leaflet-container { cursor: crosshair !important; background: transparent !important; }
                .leaflet-control-attribution { display: none !important; }
                .leaflet-control-layers { border-radius: 12px; border: none; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
            ` }} />
        </div>
    );
}
