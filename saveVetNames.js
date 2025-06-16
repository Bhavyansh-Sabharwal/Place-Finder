require('dotenv').config();
const { Client } = require('@googlemaps/google-maps-services-js');
const fs = require('fs');
const path = require('path');

class VetNamesSaver {
    constructor() {
        this.client = new Client({});
        this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
        this.address = "10850 SW 93rd St, Miami, FL 33176";
        this.radius = 16093; // 10 miles in meters
    }

    async geocodeAddress() {
        console.log(`🔍 Getting coordinates for: ${this.address}`);
        
        const response = await this.client.geocode({
            params: {
                address: this.address,
                key: this.apiKey,
            },
        });

        if (response.data.results.length === 0) {
            throw new Error('Address not found');
        }

        return response.data.results[0].geometry.location;
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI/180;
        const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180;
        const Δλ = (lon2-lon1) * Math.PI/180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        const d = R * c; // Distance in meters
        return d;
    }

    generateSearchPoints(centerLat, centerLng, radiusMiles) {
        const points = [];
        const searchRadiusMeters = 3000; // Use smaller 3km radius for each search
        const searchRadiusMiles = searchRadiusMeters * 0.000621371;
        
        const stepSize = searchRadiusMiles * 0.7; // Overlap searches by 30%
        const steps = Math.ceil((radiusMiles * 2) / stepSize);
        
        console.log(`📍 Creating ${steps}x${steps} search grid for comprehensive coverage...`);
        
        for (let x = -Math.floor(steps/2); x <= Math.floor(steps/2); x++) {
            for (let y = -Math.floor(steps/2); y <= Math.floor(steps/2); y++) {
                const latOffset = (x * stepSize) / 69;
                const lngOffset = (y * stepSize) / (69 * Math.cos(centerLat * Math.PI / 180));
                
                const pointLat = centerLat + latOffset;
                const pointLng = centerLng + lngOffset;
                
                const distance = this.calculateDistance(centerLat, centerLng, pointLat, pointLng) * 0.000621371;
                
                if (distance <= radiusMiles) {
                    points.push({
                        lat: pointLat,
                        lng: pointLng,
                        searchRadius: searchRadiusMeters
                    });
                }
            }
        }
        
        console.log(`🎯 Generated ${points.length} search points`);
        return points;
    }

    async searchSinglePoint(location, searchRadius) {
        let allResults = [];
        let nextPageToken = null;

        do {
            const params = {
                location: location,
                radius: searchRadius,
                type: 'veterinary_care',
                key: this.apiKey,
            };

            if (nextPageToken) {
                params.pagetoken = nextPageToken;
            }

            const response = await this.client.placesNearby({
                params: params,
            });

            const results = response.data.results;
            allResults = allResults.concat(results);
            
            nextPageToken = response.data.next_page_token;

            if (nextPageToken) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

        } while (nextPageToken);

        return allResults;
    }

    async findAllVeterinarians(location) {
        console.log(`🐕 Comprehensive search for ALL veterinarians within 5 miles...`);
        console.log(`📋 Using multiple overlapping searches to bypass 60-result limit\n`);
        
        const radiusMiles = this.radius * 0.000621371;
        const searchPoints = this.generateSearchPoints(location.lat, location.lng, radiusMiles);
        
        let allResults = [];
        const seenPlaceIds = new Set();
        
        for (let i = 0; i < searchPoints.length; i++) {
            const point = searchPoints[i];
            console.log(`🔍 Searching point ${i + 1}/${searchPoints.length}`);
            
            try {
                const results = await this.searchSinglePoint(point, point.searchRadius);
                
                let newResults = 0;
                results.forEach(vet => {
                    if (!seenPlaceIds.has(vet.place_id)) {
                        const distance = this.calculateDistance(
                            location.lat, location.lng,
                            vet.geometry.location.lat, vet.geometry.location.lng
                        ) * 0.000621371;
                        
                        if (distance <= radiusMiles) {
                            seenPlaceIds.add(vet.place_id);
                            allResults.push(vet);
                            newResults++;
                        }
                    }
                });
                
                console.log(`   ✅ Found ${results.length} total, ${newResults} new`);
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                console.log(`   ⚠️ Error at this point: ${error.message}`);
            }
        }

        console.log(`\n🎉 COMPREHENSIVE SEARCH COMPLETE:`);
        console.log(`   📊 Total unique veterinarians: ${allResults.length}`);
        console.log(`   🔍 Searched ${searchPoints.length} areas\n`);
        
        return allResults;
    }

    formatDistance(meters) {
        const miles = meters * 0.000621371;
        return `${miles.toFixed(2)} miles`;
    }

    saveToCSVFile(veterinarians, userLocation) {
        try {
            // Calculate distances and sort by closest first
            const veterinariansWithDistance = veterinarians.map(vet => {
                const distance = this.calculateDistance(
                    userLocation.lat, 
                    userLocation.lng, 
                    vet.geometry.location.lat, 
                    vet.geometry.location.lng
                );
                return { ...vet, calculatedDistance: distance };
            });

            // Sort by distance (closest first)
            veterinariansWithDistance.sort((a, b) => a.calculatedDistance - b.calculatedDistance);
            
            // Create filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const filename = `veterinarians_${timestamp}.csv`;
            const filepath = path.join(process.cwd(), filename);
            
            // Create CSV content
            const csvHeader = 'Name,Address,Phone,Distance (miles),Rating,Reviews,Place ID\n';
            
            const csvRows = veterinariansWithDistance.map(vet => {
                const name = `"${(vet.name || '').replace(/"/g, '""')}"`;
                const address = `"${(vet.vicinity || '').replace(/"/g, '""')}"`;
                const phone = `"${(vet.formatted_phone_number || 'N/A').replace(/"/g, '""')}"`;
                const distance = this.formatDistance(vet.calculatedDistance);
                const rating = vet.rating || 'N/A';
                const reviews = vet.user_ratings_total || 0;
                const placeId = vet.place_id || '';
                
                return `${name},${address},${phone},${distance},${rating},${reviews},${placeId}`;
            });
            
            const csvContent = csvHeader + csvRows.join('\n');
            
            // Write to file
            fs.writeFileSync(filepath, csvContent, 'utf8');
            
            console.log(`\n💾 SAVED TO CSV FILE:`);
            console.log(`   📁 Filename: ${filename}`);
            console.log(`   📍 Full path: ${filepath}`);
            console.log(`   📊 Contains: ${veterinariansWithDistance.length} veterinarians`);
            console.log(`   📋 Columns: Name, Address, Phone, Distance, Rating, Reviews, Place ID`);
            console.log(`   📏 Sorted by: Distance (closest first)`);
            console.log(`   ✅ File ready for download!`);
            
            return filepath;
            
        } catch (error) {
            console.error('❌ Error saving to CSV file:', error.message);
            return null;
        }
    }

    async run() {
        try {
            console.log('🚀 Starting veterinarian names collection...\n');

            // Get coordinates
            const location = await this.geocodeAddress();

            // Find all veterinarians
            const veterinarians = await this.findAllVeterinarians(location);

            if (veterinarians.length === 0) {
                console.log('❌ No veterinarians found within 10 miles.');
                return;
            }

            // Save to CSV file
            const savedFile = this.saveToCSVFile(veterinarians, location);

            console.log('\n🎯 TASK COMPLETED SUCCESSFULLY!');
            console.log(`   You can now download: ${path.basename(savedFile)}`);

        } catch (error) {
            console.error('❌ Error:', error.message);
        }
    }
}

// Run if called directly
if (require.main === module) {
    const saver = new VetNamesSaver();
    saver.run();
}

module.exports = VetNamesSaver; 