# Find All Veterinarians Nearby 🐕🏥

A Node.js application that uses the Google Maps Places API to find all veterinarian shops within a 5-mile radius of your address.

## 📍 Your Search Location
**Address:** 10850 SW 93rd St, Miami, FL 33176  
**Search Radius:** 10 miles

## 🚀 Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure your API key:**
   Make sure your `.env` file contains your Google Maps API key:
   ```
   GOOGLE_MAPS_API_KEY=your_api_key_here
   ```

3. **Enable required APIs:**
   In your Google Cloud Console, ensure these APIs are enabled:
   - Places API
   - Geocoding API

## 🔍 Usage

### Find All Veterinarians
Run the main search script:
```bash
npm start
# or
node findVets.js
```

This will:
- Convert your address to coordinates
- Search for veterinarians within 10 miles
- Fetch ALL available results (not limited to 20)
- Display results with names, addresses, ratings, and distances

### Get Detailed Information
To get detailed info about a specific veterinarian:
```bash
node getVetDetails.js <place_id>
```

Example:
```bash
node getVetDetails.js ChIJN1t_tDeuEmsRUsoyG83frY4
```

This will show:
- Full contact information
- Opening hours
- Recent reviews
- Price level
- Google Maps link

## 📊 Output Example

```
🎯 SEARCH RESULTS
================================================================================
Found 12 veterinarian(s) within 5 miles:
================================================================================

1. Miami Animal Hospital
   📍 Address: 12345 SW 88th St, Miami, FL
   📏 Distance: 1.23 miles
   ⭐ Rating: 4.5 (127 reviews)
   🏪 Status: OPERATIONAL
   🆔 Place ID: ChIJN1t_tDeuEmsRUsoyG83frY4

2. Westside Veterinary Clinic
   📍 Address: 9876 SW 107th Ave, Miami, FL
   📏 Distance: 2.45 miles
   ⭐ Rating: 4.2 (89 reviews)
   🏪 Status: OPERATIONAL
   🆔 Place ID: ChIJabcdefghijklmnopqrstuvwxyz
```

## 🛠️ Features

- **Accurate geocoding** of your address
- **Distance calculation** for each veterinarian
- **Comprehensive search** using Google Places API
- **Detailed information** retrieval for specific locations
- **Clean, formatted output** with ratings and contact info
- **Error handling** for API issues and invalid addresses

## 📋 Requirements

- Node.js 14+
- Valid Google Maps API key with Places API enabled
- Internet connection for API calls

## 🔧 Configuration

You can modify the search parameters in `findVets.js`:
- Change the `address` property to search from a different location
- Adjust the `radius` property to change the search distance (currently 10 miles = 16093 meters)
- Modify the search type from `veterinary_care` to find other business types

## 🚨 Troubleshooting

**API Key Issues:**
- Ensure your API key is correctly set in `.env`
- Check that Places API and Geocoding API are enabled
- Verify your API key has the necessary permissions

**No Results:**
- Try increasing the search radius
- Check if the address is correctly formatted
- Ensure you're in an area with veterinary services

**Rate Limiting:**
- The Google Places API has usage limits
- If you hit limits, wait before making more requests
- Consider implementing request throttling for large searches 