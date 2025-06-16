from flask import Flask, render_template, request, jsonify, send_file
import os
from datetime import datetime
import subprocess
import json
import glob

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/search', methods=['POST'])
def search():
    data = request.json
    address = data.get('address')
    distance = data.get('distance')
    place_type = data.get('place_type')
    
    # Generate timestamp for the output file
    timestamp = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
    output_file = f"{place_type}_{timestamp}.csv"
    
    # Run the Node.js script with the provided parameters
    try:
        # Convert distance from miles to meters (1 mile = 1609.34 meters)
        distance_meters = int(float(distance) * 1609.34)
        
        # Create the command with proper argument passing
        cmd = ['node', 'findVets.js', address, str(distance_meters), place_type]
        
        # Run the command and capture output
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            env=dict(os.environ, GOOGLE_MAPS_API_KEY=os.getenv('GOOGLE_MAPS_API_KEY'))
        )
        
        if result.returncode == 0:
            # Look for the most recent CSV file matching the pattern
            pattern = f"{place_type}_*.csv"
            matching_files = glob.glob(pattern)
            
            if matching_files:
                # Sort by modification time (newest first)
                latest_file = max(matching_files, key=os.path.getmtime)
                return jsonify({
                    'success': True,
                    'message': 'Search completed successfully',
                    'output_file': latest_file
                })
            else:
                return jsonify({
                    'success': False,
                    'message': 'Search completed but no output file was found'
                }), 500
        else:
            error_message = result.stderr if result.stderr else 'Unknown error occurred'
            return jsonify({
                'success': False,
                'message': f'Error: {error_message}'
            }), 500
            
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error: {str(e)}'
        }), 500

@app.route('/download/<filename>')
def download_file(filename):
    try:
        if not os.path.exists(filename):
            return jsonify({
                'success': False,
                'message': f'File {filename} not found'
            }), 404
        return send_file(filename, as_attachment=True)
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error downloading file: {str(e)}'
        }), 500

if __name__ == '__main__':
    app.run(debug=True) 