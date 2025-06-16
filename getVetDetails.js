require('dotenv').config();
const { Client } = require('@googlemaps/google-maps-services-js');

class VetDetailsGetter {
    constructor() {
        this.client = new Client({});
        this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
    }

    async getVetDetails(placeId) {
        try {
            console.log(`🔍 Getting detailed information for place ID: ${placeId}`);
            
            const response = await this.client.placeDetails({
                params: {
                    place_id: placeId,
                    fields: [
                        'name', 'formatted_address', 'formatted_phone_number', 
                        'website', 'rating', 'user_ratings_total', 'opening_hours',
                        'reviews', 'photos', 'price_level', 'url'
                    ],
                    key: this.apiKey,
                },
            });

            return response.data.result;
        } catch (error) {
            console.error('❌ Error getting veterinarian details:', error.message);
            throw error;
        }
    }

    displayDetailedInfo(vet) {
        console.log('\n🏥 VETERINARIAN DETAILS');
        console.log('=' .repeat(60));
        console.log(`🏪 Name: ${vet.name}`);
        console.log(`📍 Address: ${vet.formatted_address || 'N/A'}`);
        console.log(`📞 Phone: ${vet.formatted_phone_number || 'N/A'}`);
        console.log(`🌐 Website: ${vet.website || 'N/A'}`);
        console.log(`⭐ Rating: ${vet.rating || 'N/A'} (${vet.user_ratings_total || 0} reviews)`);
        console.log(`💰 Price Level: ${vet.price_level ? '$'.repeat(vet.price_level) : 'N/A'}`);
        console.log(`🔗 Google Maps: ${vet.url || 'N/A'}`);

        // Opening Hours
        if (vet.opening_hours) {
            console.log('\n🕒 OPENING HOURS:');
            vet.opening_hours.weekday_text.forEach(day => {
                console.log(`   ${day}`);
            });
            console.log(`   Currently ${vet.opening_hours.open_now ? 'OPEN' : 'CLOSED'}`);
        }

        // Recent Reviews
        if (vet.reviews && vet.reviews.length > 0) {
            console.log('\n💬 RECENT REVIEWS:');
            vet.reviews.slice(0, 3).forEach((review, index) => {
                console.log(`   ${index + 1}. ⭐ ${review.rating}/5 - ${review.author_name}`);
                console.log(`      "${review.text.substring(0, 100)}${review.text.length > 100 ? '...' : ''}"`);
                console.log(`      (${new Date(review.time * 1000).toLocaleDateString()})\n`);
            });
        }
    }

    async run(placeId) {
        try {
            if (!placeId) {
                console.log('❌ Please provide a place ID');
                console.log('Usage: node getVetDetails.js <place_id>');
                return;
            }

            const vetDetails = await this.getVetDetails(placeId);
            this.displayDetailedInfo(vetDetails);

        } catch (error) {
            console.error('❌ Failed to get veterinarian details:', error.message);
        }
    }
}

// Run if called directly
if (require.main === module) {
    const placeId = process.argv[2];
    const detailsGetter = new VetDetailsGetter();
    detailsGetter.run(placeId);
}

module.exports = VetDetailsGetter; 