// Step 1: Define region of interest (ROI) - Juba, South Sudan
var roi = ee.Geometry.Point([31.5789, 4.8517]).buffer(20000); // 20 km radius
print('Region of Interest Defined.');

// Step 2: Function to compute urban growth indices
function computeIndices(image) {
  var ndvi = image.expression(
    '(NIR - RED) / (NIR + RED)', {
      'NIR': image.select('NIR'),
      'RED': image.select('Red')
    }).rename('NDVI');

  var ndbi = image.expression(
    '(SWIR1 - NIR) / (SWIR1 + NIR)', {
      'SWIR1': image.select('SWIR1'),
      'NIR': image.select('NIR')
    }).rename('NDBI');

  var mndwi = image.expression(
    '(GREEN - SWIR1) / (GREEN + SWIR1)', {
      'GREEN': image.select('Green'),
      'SWIR1': image.select('SWIR1')
    }).rename('MNDWI');

  return image.addBands([ndvi, ndbi, mndwi]);
}

// Step 3: Process Landsat 5 (1990-2005)
var landsat5 = ee.ImageCollection('LANDSAT/LT05/C02/T1_L2')
                .filterBounds(roi)
                .filterDate('1990-01-01', '2005-12-31')
                .map(function(image) {
                  return image.select(['SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B7'],
                                      ['Blue', 'Green', 'Red', 'NIR', 'SWIR1', 'SWIR2']);
                })
                .map(computeIndices)
                .median();

print('Landsat 1990-2005 indices computed successfully.');

// Step 4: Process Landsat 7 & 8 (2005-2020)
var landsat7 = ee.ImageCollection('LANDSAT/LE07/C02/T1_L2')
                .filterBounds(roi)
                .filterDate('2005-01-01', '2013-06-05')
                .map(function(image) {
                  return image.select(['SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B7'],
                                      ['Blue', 'Green', 'Red', 'NIR', 'SWIR1', 'SWIR2']);
                });

var landsat8 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
                .filterBounds(roi)
                .filterDate('2013-06-06', '2020-12-31')
                .map(function(image) {
                  return image.select(['SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B6', 'SR_B7'],
                                      ['Blue', 'Green', 'Red', 'NIR', 'SWIR1', 'SWIR2']);
                });

var landsatCollection = landsat7.merge(landsat8).map(computeIndices).median();
print('Landsat 2005-2020 indices computed successfully.');

// Step 5: Export NDVI, NDBI, and MNDWI results

// Export for 1990-2005 period with EPSG:32636 and 30m scale
Export.image.toDrive({
  image: landsat5.select(['NDVI', 'NDBI', 'MNDWI']),
  description: 'Urban_Indices_1990_2005',
  folder: 'GEE_Exports',
  fileNamePrefix: 'Urban_Growth_1990_2005',
  region: roi,
  scale: 30,  // Landsat native resolution
  crs: 'EPSG:32636',  // UTM Zone 36N for Juba
  fileFormat: 'GeoTIFF',
  maxPixels: 1e13
});

print('Exporting Urban Indices 1990-2005 to Google Drive');

// Export for 2005-2020 period with EPSG:32636 and 30m scale
Export.image.toDrive({
  image: landsatCollection.select(['NDVI', 'NDBI', 'MNDWI']),
  description: 'Urban_Indices_2005_2020',
  folder: 'GEE_Exports',
  fileNamePrefix: 'Urban_Growth_2005_2020',
  region: roi,
  scale: 30,  // Landsat native resolution
  crs: 'EPSG:32636',  // UTM Zone 36N for Juba
  fileFormat: 'GeoTIFF',
  maxPixels: 1e13
});

print('Exporting Urban Indices 2005-2020 to Google Drive');

// Step 6: Display results
Map.centerObject(roi, 8);
Map.addLayer(landsat5.select('NDVI'), {min: -1, max: 1, palette: ['blue', 'white', 'green']}, 'NDVI 1990-2005');
Map.addLayer(landsatCollection.select('NDVI'), {min: -1, max: 1, palette: ['blue', 'white', 'green']}, 'NDVI 2005-2020');

print('Urban growth indices export initiated.');
