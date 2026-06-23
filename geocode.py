import json
import urllib.request
import urllib.parse
import time

def geocode(place, city):
    query = urllib.parse.quote(f"{place} {city}")
    url = f"https://nominatim.openstreetmap.org/search?q={query}&format=json&limit=1"
    req = urllib.request.Request(url, headers={'User-Agent': 'TravelConcierge/1.0'})
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            if data:
                return {"lat": float(data[0]["lat"]), "lng": float(data[0]["lon"])}
    except Exception as e:
        print(f"Error geocoding {place}: {e}")
    
    # Fallback to just city if place fails
    if place != city:
        query = urllib.parse.quote(city)
        url = f"https://nominatim.openstreetmap.org/search?q={query}&format=json&limit=1"
        req = urllib.request.Request(url, headers={'User-Agent': 'TravelConcierge/1.0'})
        try:
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode())
                if data:
                    return {"lat": float(data[0]["lat"]), "lng": float(data[0]["lon"])}
        except:
            pass
    return {"lat": 13.7563, "lng": 100.5018} # default BKK

with open("public/trips.json", "r") as f:
    trips = json.load(f)

for trip in trips:
    for day in trip.get("itinerary", []):
        city = day["location"]
        for dest in day.get("destinations", []):
            print(f"Geocoding {dest['name']} in {city}...")
            coords = geocode(dest["name"], city)
            dest["coordinates"] = coords
            time.sleep(1) # respect nominatim rate limits
        for food in day.get("food", []):
            print(f"Geocoding {food['name']} in {city}...")
            coords = geocode(food["name"], city)
            food["coordinates"] = coords
            time.sleep(1)

with open("public/trips.json", "w") as f:
    json.dump(trips, f, indent=2)

print("Done geocoding!")
