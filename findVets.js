require('dotenv').config();
const { Client } = require('@googlemaps/google-maps-services-js');
const fs = require('fs');
const path = require('path');

class VeterinarianFinder {
    constructor(address, radius, placeType) {
        this.client = new Client({});
        this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
        this.address = address;
        this.radius = radius; // radius in meters
        this.placeType = placeType;
    }

    async geocodeAddress() {
        try {
            console.log(`🔍 Geocoding address: ${this.address}`);
            
            const response = await this.client.geocode({
                params: {
                    address: this.address,
                    key: this.apiKey,
                },
            });

            if (response.data.results.length === 0) {
                throw new Error('Address not found');
            }

            const location = response.data.results[0].geometry.location;
            console.log(`📍 Coordinates found: ${location.lat}, ${location.lng}`);
            return location;
        } catch (error) {
            console.error('❌ Error geocoding address:', error.message);
            throw error;
        }
    }

    // Generate search points in a grid pattern to cover the entire area
    generateSearchPoints(centerLat, centerLng, radiusMiles) {
        const points = [];
        const searchRadiusMeters = 3000; // Use smaller 3km radius for each search
        const searchRadiusMiles = searchRadiusMeters * 0.000621371;
        
        // Calculate how many points we need to cover the area
        const stepSize = searchRadiusMiles * 0.7; // Overlap searches by 30%
        const steps = Math.ceil((radiusMiles * 2) / stepSize);
        
        console.log(`📍 Creating ${steps}x${steps} search grid to ensure complete coverage...`);
        
        for (let x = -Math.floor(steps/2); x <= Math.floor(steps/2); x++) {
            for (let y = -Math.floor(steps/2); y <= Math.floor(steps/2); y++) {
                const latOffset = (x * stepSize) / 69; // Approximate miles to degrees
                const lngOffset = (y * stepSize) / (69 * Math.cos(centerLat * Math.PI / 180));
                
                const pointLat = centerLat + latOffset;
                const pointLng = centerLng + lngOffset;
                
                // Check if this point is within our overall search radius
                const distance = this.calculateDistance(centerLat, centerLng, pointLat, pointLng) * 0.000621371; // Convert to miles
                
                if (distance <= radiusMiles) {
                    points.push({
                        lat: pointLat,
                        lng: pointLng,
                        searchRadius: searchRadiusMeters
                    });
                }
            }
        }
        
        console.log(`🎯 Generated ${points.length} search points to cover the area comprehensively`);
        return points;
    }

    async searchSinglePoint(location, searchRadius) {
        let allResults = [];
        let nextPageToken = null;
        let pageCount = 0;

        do {
            pageCount++;
            const params = {
                location: location,
                radius: searchRadius,
                type: this.placeType,
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

    async findVeterinarians(location) {
        try {
            console.log(`🐕 Comprehensive search for ALL veterinarians within 10 miles...`);
            console.log(`📋 Using multiple overlapping searches to bypass Google's 60-result limit\n`);
            
            const radiusMiles = this.radius * 0.000621371;
            const searchPoints = this.generateSearchPoints(location.lat, location.lng, radiusMiles);
            
            let allResults = [];
            const seenPlaceIds = new Set();
            
            for (let i = 0; i < searchPoints.length; i++) {
                const point = searchPoints[i];
                console.log(`🔍 Searching point ${i + 1}/${searchPoints.length} (${point.lat.toFixed(4)}, ${point.lng.toFixed(4)})`);
                
                try {
                    const results = await this.searchSinglePoint(point, point.searchRadius);
                    
                    let newResults = 0;
                    results.forEach(vet => {
                        if (!seenPlaceIds.has(vet.place_id)) {
                            // Check if this vet is actually within our desired radius from the original location
                            const distance = this.calculateDistance(
                                location.lat, location.lng,
                                vet.geometry.location.lat, vet.geometry.location.lng
                            ) * 0.000621371; // Convert to miles
                            
                            if (distance <= radiusMiles) {
                                seenPlaceIds.add(vet.place_id);
                                allResults.push(vet);
                                newResults++;
                            }
                        }
                    });
                    
                    console.log(`   ✅ Found ${results.length} total, ${newResults} new veterinarians`);
                    
                    // Small delay between searches to be respectful to the API
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                } catch (error) {
                    console.log(`   ⚠️ Error at this point: ${error.message}`);
                }
            }

            console.log(`\n🎉 COMPREHENSIVE SEARCH COMPLETE:`);
            console.log(`   📊 Total unique veterinarians found: ${allResults.length}`);
            console.log(`   🔍 Searched ${searchPoints.length} overlapping areas`);
            console.log(`   ✅ Bypassed Google's 60-result limit!\n`);
            
            return allResults;

        } catch (error) {
            console.error('❌ Error finding veterinarians:', error.message);
            throw error;
        }
    }

    async getPlaceDetails(placeId) {
        try {
            const response = await this.client.placeDetails({
                params: {
                    place_id: placeId,
                    fields: ['name', 'formatted_address', 'formatted_phone_number', 'website', 'rating', 'user_ratings_total', 'opening_hours', 'reviews'],
                    key: this.apiKey,
                },
            });

            return response.data.result;
        } catch (error) {
            console.error(`❌ Error getting details for place ${placeId}:`, error.message);
            return null;
        }
    }

    formatDistance(meters) {
        const miles = meters * 0.000621371;
        return `${miles.toFixed(2)} miles`;
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

    displayResults(veterinarians, userLocation) {
        console.log('\n🎯 SEARCH RESULTS');
        console.log('=' .repeat(80));
        console.log(`Found ${veterinarians.length} veterinarian(s) within 10 miles:`);
        console.log('=' .repeat(80));

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
        
        console.log('📏 Results sorted by distance (closest first):\n');

        veterinariansWithDistance.forEach((vet, index) => {
            console.log(`\n${index + 1}. ${vet.name}`);
            console.log(`   📍 Address: ${vet.vicinity}`);
            console.log(`   📞 Phone: ${vet.formatted_phone_number || 'N/A'}`);
            console.log(`   📏 Distance: ${this.formatDistance(vet.calculatedDistance)}`);
            console.log(`   ⭐ Rating: ${vet.rating || 'N/A'} (${vet.user_ratings_total || 0} reviews)`);
            console.log(`   🏪 Status: ${vet.business_status || 'Unknown'}`);
            console.log(`   🆔 Place ID: ${vet.place_id}`);
            
            if (vet.types) {
                console.log(`   🏷️  Types: ${vet.types.join(', ')}`);
            }
        });

        return veterinariansWithDistance;
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
            const filename = `${this.placeType}_${timestamp}.csv`;
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
            console.log(`   📁 File: ${filename}`);
            console.log(`   📍 Location: ${filepath}`);
            console.log(`   📊 Contains: ${veterinariansWithDistance.length} results`);
            console.log(`   📋 Columns: Name, Address, Phone, Distance, Rating, Reviews, Place ID`);
            console.log(`   📏 Sorted by: Distance (closest first)`);
            console.log(`   ✅ Ready for download!`);
            
            return filepath;
            
        } catch (error) {
            console.error('❌ Error saving to CSV file:', error.message);
            return null;
        }
    }

    async searchVeterinarians() {
        try {
            console.log('🚀 Starting veterinarian search...\n');

            // Step 1: Get coordinates for the address
            const location = await this.geocodeAddress();

            // Step 2: Search for veterinarians nearby
            const veterinarians = await this.findVeterinarians(location);

            if (veterinarians.length === 0) {
                console.log('❌ No veterinarians found within 5 miles of your address.');
                return;
            }

            // Step 3: Get detailed information (including phone numbers) for each veterinarian
            console.log('\n🔍 Getting detailed information (phone numbers, etc.)...');
            const veterinariansWithDetails = [];
            
            for (let i = 0; i < veterinarians.length; i++) {
                const vet = veterinarians[i];
                console.log(`   📞 Fetching details for ${vet.name} (${i + 1}/${veterinarians.length})`);
                
                const details = await this.getPlaceDetails(vet.place_id);
                if (details) {
                    // Merge the original vet data with detailed information
                    const vetWithDetails = {
                        ...vet,
                        formatted_phone_number: details.formatted_phone_number,
                        website: details.website,
                        opening_hours: details.opening_hours,
                        reviews: details.reviews
                    };
                    veterinariansWithDetails.push(vetWithDetails);
                } else {
                    // If we can't get details, keep the original data
                    veterinariansWithDetails.push(vet);
                }
                
                // Add a small delay to avoid hitting API rate limits
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            console.log('✅ Finished fetching detailed information!\n');

            // Step 4: Display results
            const sortedVeterinarians = this.displayResults(veterinariansWithDetails, location);

            // Step 5: Save to CSV file
            const savedFile = this.saveToCSVFile(sortedVeterinarians, location);

            // Step 6: Offer to get detailed information
            console.log('\n💡 TIP: To get detailed information about any veterinarian (phone, website, hours),');
            console.log('    run: node getVetDetails.js <place_id>');
            
            return veterinariansWithDetails;

        } catch (error) {
            console.error('❌ Search failed:', error.message);
            
            if (error.message.includes('API key')) {
                console.log('\n🔑 Please check your Google Maps API key in the .env file');
                console.log('   Make sure the Places API is enabled for your key');
            }
        }
    }
}

// Get command line arguments
const args = process.argv.slice(2);
if (args.length !== 3) {
    console.error('Usage: node findVets.js <address> <radius_in_meters> <place_type>');
    process.exit(1);
}

const [address, radius, placeType] = args;

// Create instance and run search
const finder = new VeterinarianFinder(address, parseInt(radius), placeType);

async function main() {
    try {
        const location = await finder.geocodeAddress();
        const veterinarians = await finder.findVeterinarians(location);
        const results = finder.displayResults(veterinarians, location);
        finder.saveToCSVFile(veterinarians, location);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

main();

module.exports = VeterinarianFinder; 