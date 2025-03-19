// Define the region of interest (ROI) as a geometry from a table (assumed to be an imported asset named 'table2')
var juba = table2;
// Extract the geometry from the table to define the study area
var geometry = juba.geometry();
// Add the ROI geometry to the map with a teal outline for visualization
Map.addLayer(geometry, {color: '#008080'}, 'ROI - Juba');
// Center the map view on the ROI with a zoom level of 10
Map.centerObject(geometry, 10);
// Export the ROI table as a Shapefile to Google Drive for reference
Export.table.toDrive({collection: juba, description: 'ROI_Juba', folder: 'jubaPredictionNew/Roi', fileFormat: 'SHP'});

// Calculate the area of the ROI in square kilometers (converted from square meters by dividing by 1e6)
var roiArea = geometry.area({maxError: 1}).divide(1e6);
// Print the total ROI area to the console with two decimal places
print('Total ROI Area (sq km):', roiArea.format('%.2f'));

// Function to scale Landsat surface reflectance and thermal bands to physical units
function applyScaleFactors(image) {
  // Scale optical bands (SR_B1 to SR_B7) from digital numbers to reflectance (multiply by 0.0000275, offset by -0.2)
  var opticalBands = image.select(['SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B7']).multiply(0.0000275).add(-0.2);
  // Scale thermal band (ST_B6) from digital numbers to temperature in Kelvin (multiply by 0.00341802, offset by 149.0)
  var thermalBand = image.select('ST_B6').multiply(0.00341802).add(149.0);
  // Replace original bands with scaled versions in the image
  return image.addBands(opticalBands, null, true).addBands(thermalBand, null, true);
}

// Function to mask clouds and shadows in Landsat images using QA_PIXEL band
function maskClouds(image) {
  // Create a mask for clouds (bit 3 = 0 means no cloud)
  var cloudMask = image.select('QA_PIXEL').bitwiseAnd(1 << 3).eq(0);
  // Create a mask for shadows (bit 4 = 0 means no shadow)
  var shadowMask = image.select('QA_PIXEL').bitwiseAnd(1 << 4).eq(0);
  // Apply both masks to remove cloudy and shadowed pixels
  return image.updateMask(cloudMask).updateMask(shadowMask);
}

// Define color palette for land cover classes: Urban (#6f2e01), Bare (#c09272), Water (#c3f1d5), Vegetation (#566e6b)
var palette = ['#6f2e01', '#c09272', '#c3f1d5', '#566e6b'];
// Convert the palette to an Earth Engine List for internal use
var paletteList = ee.List(palette);
// Define land cover class indices: 0 = Urban, 1 = Bare, 2 = Water, 3 = Vegetation
var landcoverClasses = ee.List([0, 1, 2, 3]);

// Function to calculate and print areas for each land cover class in a classified image
function calculateAreas(image, period) {
  // Create a pixel area image in square kilometers (converted from square meters)
  var pixelArea = ee.Image.pixelArea().divide(1e6);
  // Calculate area of Urban class (class 0) by masking and summing pixel areas
  var urbanArea = pixelArea.updateMask(image.eq(0)).reduceRegion({reducer: ee.Reducer.sum(), geometry: geometry, scale: 30, tileScale: 15, maxPixels: 1e13}).get('area');
  // Calculate area of Bare class (class 1)
  var bareArea = pixelArea.updateMask(image.eq(1)).reduceRegion({reducer: ee.Reducer.sum(), geometry: geometry, scale: 30, tileScale: 15, maxPixels: 1e13}).get('area');
  // Calculate area of Water class (class 2)
  var waterArea = pixelArea.updateMask(image.eq(2)).reduceRegion({reducer: ee.Reducer.sum(), geometry: geometry, scale: 30, tileScale: 15, maxPixels: 1e13}).get('area');
  // Calculate area of Vegetation class (class 3)
  var vegetationArea = pixelArea.updateMask(image.eq(3)).reduceRegion({reducer: ee.Reducer.sum(), geometry: geometry, scale: 30, tileScale: 15, maxPixels: 1e13}).get('area');
  // Print areas for each class with two decimal places
  print('Urban Area ' + period + ' (sq km):', ee.Number(urbanArea).format('%.2f'));
  print('Bare Area ' + period + ' (sq km):', ee.Number(bareArea).format('%.2f'));
  print('Water Area ' + period + ' (sq km):', ee.Number(waterArea).format('%.2f'));
  print('Vegetation Area ' + period + ' (sq km):', ee.Number(vegetationArea).format('%.2f'));
  // Compute total area as the sum of all class areas
  var totalArea = ee.Number(urbanArea).add(bareArea).add(waterArea).add(vegetationArea);
  // Print total area
  print('Total Area ' + period + ' (sq km):', totalArea.format('%.2f'));
  // Return areas as a dictionary for later use
  return {urban: urbanArea, bare: bareArea, water: waterArea, vegetation: vegetationArea, total: totalArea};
}

// Function to classify an image using Random Forest, remap classes, and assess accuracy
function classifyAndRemap(composite, training, period) {
  // Train a Random Forest classifier with 50 trees using training data
  var rfClassifier = ee.Classifier.smileRandomForest(50).train({features: training, classProperty: 'landcover', inputProperties: composite.bandNames()});
  // Classify the composite image with the trained classifier
  var classifiedTemp = composite.classify(rfClassifier);
  // Add the temporary classified image to the map (before remapping)
  Map.addLayer(classifiedTemp, {min: 0, max: 3, palette: palette}, period + ' Random Forest Temp');
  // Remap classes: Urban (0) stays 0, Bare (1) becomes 1, Water (2) stays 2, Vegetation (3) stays 3, clip to ROI
  var classified = ee.Image(1).where(classifiedTemp.eq(0), 0).where(classifiedTemp.eq(2), 2).where(classifiedTemp.eq(3), 3).clip(geometry);
  // Add the final classified image to the map
  Map.addLayer(classified, {min: 0, max: 3, palette: palette}, period + ' Random Forest');
  // Validate classification by sampling regions from the composite using 2003 GCPs
  var validation = composite.classify(rfClassifier).sampleRegions({collection: gcps2003, properties: ['landcover'], scale: 30, tileScale: 8});
  // Compute confusion matrix comparing actual vs. predicted classes
  var confusionMatrix = validation.errorMatrix('landcover', 'classification');
  // Print confusion matrix and accuracy metrics
  print(period + ' Confusion Matrix:', confusionMatrix);
  print(period + ' Overall Accuracy:', confusionMatrix.accuracy().format('%.2f'));
  print(period + ' Producer\'s Accuracy (Urban, Bare, Water, Vegetation):', confusionMatrix.producersAccuracy());
  print(period + ' Consumer\'s Accuracy (Urban, Bare, Water, Vegetation):', confusionMatrix.consumersAccuracy());
  // Calculate areas for the classified image
  var areas = calculateAreas(classified, 'Random Forest ' + period);
  // Export the classified image to Google Drive as a GeoTIFF
  Export.image.toDrive({image: classified, description: 'Classified_' + period.replace(' ', '_') + '_Random_Forest', folder: 'jubaPredictionNew/' + period.replace(' ', ''), scale: 30, region: geometry, maxPixels: 1e13});
  // Return classified image and areas for further use
  return {classified: classified, areas: areas};
}

// Define ground control points (GCPs) by merging class-specific point collections for training
var gcps2003 = urban2003.merge(bare2003).merge(water2003).merge(vegetation2003); // GCPs for 2003
var gcps2013 = urban2013.merge(bare2003).merge(water2003).merge(vegetation2003); // GCPs for 2013, reusing 2003 bare/water/vegetation
var gcps2023 = urban2013.merge(bare2003).merge(water2003).merge(vegetation2003); // GCPs for 2023, reusing 2003 bare/water/vegetation

// Export GCPs for 2003 as a Shapefile to Google Drive, containing point geometries and landcover properties
Export.table.toDrive({
  collection: gcps2003,
  description: 'GCPs_2003',
  folder: 'jubaPredictionNew/GCPs',
  fileFormat: 'SHP'
});

// Export GCPs for 2013 as a Shapefile to Google Drive
Export.table.toDrive({
  collection: gcps2013,
  description: 'GCPs_2013',
  folder: 'jubaPredictionNew/GCPs',
  fileFormat: 'SHP'
});

// Export GCPs for 2023 as a Shapefile to Google Drive
Export.table.toDrive({
  collection: gcps2023,
  description: 'GCPs_2023',
  folder: 'jubaPredictionNew/GCPs',
  fileFormat: 'SHP'
});

// Define the band names used in Landsat images for classification
var bandNames = ['SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B7', 'ST_B6'];

// Process Landsat 5 data for 1994-2003
var dataset19942003 = ee.ImageCollection('LANDSAT/LT05/C02/T1_L2').filterDate('1994-01-01', '2003-12-31').filterBounds(geometry); // Load Landsat 5 images
print('Number of Landsat 5 images (1994-2003):', dataset19942003.size()); // Print count of images
var scaledDataset19942003 = dataset19942003.map(applyScaleFactors); // Apply scaling to reflectance and temperature
var maskedDataset19942003 = scaledDataset19942003.map(maskClouds); // Mask clouds and shadows
var composite19942003 = maskedDataset19942003.median().select(bandNames).clip(geometry); // Create median composite clipped to ROI
var training2003 = composite19942003.sampleRegions({collection: gcps2003, properties: ['landcover'], scale: 30, tileScale: 8}).filter(ee.Filter.notNull(bandNames.concat(['landcover']))); // Sample training points
print('Number of training samples (1994-2003):', training2003.size()); // Print training sample count
print('Sample training data (1994-2003):', training2003.limit(5)); // Print first 5 training samples
Map.addLayer(composite19942003, {bands: ['SR_B3', 'SR_B2', 'SR_B1'], min: 0.0, max: 0.3}, 'Collection (1994-2003)'); // Add composite to map as RGB
var result2003 = classifyAndRemap(composite19942003, training2003, '1994-2003'); // Classify and remap
var classified2003 = result2003.classified; // Extract classified image
var areas2003 = result2003.areas; // Extract areas
Export.image.toDrive({image: composite19942003, description: 'Collection_1994_2003', folder: 'jubaPredictionNew/19942003', scale: 30, region: geometry, maxPixels: 1e13}); // Export composite

// Process Landsat 7 data for 2004-2013
var dataset20042013 = ee.ImageCollection('LANDSAT/LE07/C02/T1_L2').filterDate('2004-01-01', '2013-12-31').filterBounds(geometry);
print('Number of Landsat 7 images (2004-2013):', dataset20042013.size());
var scaledDataset20042013 = dataset20042013.map(applyScaleFactors);
var maskedDataset20042013 = scaledDataset20042013.map(maskClouds);
var composite20042013 = maskedDataset20042013.median().select(bandNames).clip(geometry);
var training2013 = composite20042013.sampleRegions({collection: gcps2013, properties: ['landcover'], scale: 30, tileScale: 8}).filter(ee.Filter.notNull(bandNames.concat(['landcover'])));
print('Number of training samples (2004-2013):', training2013.size());
print('Sample training data (2004-2013):', training2013.limit(5));
Map.addLayer(composite20042013, {bands: ['SR_B3', 'SR_B2', 'SR_B1'], min: 0.0, max: 0.3}, 'Collection (2004-2013)');
var result2013 = classifyAndRemap(composite20042013, training2013, '2004-2013');
var classified2013 = result2013.classified;
var areas2013 = result2013.areas;
Export.image.toDrive({image: composite20042013, description: 'Collection_2004_2013', folder: 'jubaPredictionNew/20042013', scale: 30, region: geometry, maxPixels: 1e13});

// Process Landsat 7 data for 2014-2023
var dataset20142023 = ee.ImageCollection('LANDSAT/LE07/C02/T1_L2').filterDate('2014-01-01', '2023-12-31').filterBounds(geometry);
print('Number of Landsat 7 images (2014-2023):', dataset20142023.size());
var scaledDataset20142023 = dataset20142023.map(applyScaleFactors);
var maskedDataset20142023 = scaledDataset20142023.map(maskClouds);
var composite20142023 = maskedDataset20142023.median().select(bandNames).clip(geometry);
var training2023 = composite20142023.sampleRegions({collection: gcps2013, properties: ['landcover'], scale: 30, tileScale: 15}).filter(ee.Filter.notNull(bandNames.concat(['landcover'])));
print('Number of training samples (2014-2023):', training2023.size());
print('Sample training data (2014-2023):', training2023.limit(5));
Map.addLayer(composite20142023, {bands: ['SR_B3', 'SR_B2', 'SR_B1'], min: 0.0, max: 0.3}, 'Collection (2014-2023)');
var result20142023 = classifyAndGetConfusionMatrix(composite20142023, training2023, '2014-2023');
var areas2023 = calculateAreas(result20142023.classified, '2014-2023');
Export.image.toDrive({image: composite20142023, description: 'Collection_2014_2023', folder: 'jubaPredictionNew/20142023', scale: 30, region: geometry, maxPixels: 1e13});

// Calculate urban growth rates between periods
var years2003to2013 = 2013 - 2003; // Number of years between 2003 and 2013
var years2013to2023 = 2023 - 2013; // Number of years between 2013 and 2023
var urbanGrowth2003to2013 = ee.Number(areas2013.urban).subtract(areas2003.urban).divide(years2003to2013); // Annual urban growth rate 2003-2013
var urbanGrowth2013to2023 = ee.Number(areas2023.urban).subtract(areas2013.urban).divide(years2013to2023); // Annual urban growth rate 2013-2023
var avgUrbanGrowthRate = urbanGrowth2003to2013.add(urbanGrowth2013to2023).divide(2); // Average urban growth rate
print('Urban Growth Rate 2003-2013 (sq km/year):', urbanGrowth2003to2013.format('%.2f')); // Print growth rates
print('Urban Growth Rate 2013-2023 (sq km/year):', urbanGrowth2013to2023.format('%.2f'));
print('Average Urban Growth Rate (sq km/year):', avgUrbanGrowthRate.format('%.2f'));

// Function to predict land cover for 2033 using 1994-2023 data
function predictUsing1994_2023() {
  // Combine training data from all periods
  var combinedTraining = training2003.merge(training2013).merge(training2023);
  print('Number of training samples (1994-2023):', combinedTraining.size());
  print('Sample training data (1994-2023):', combinedTraining.limit(5));
  
  // Calculate spectral changes between periods
  var spectralChange1 = composite20042013.subtract(composite19942003); // Change from 1994-2003 to 2004-2013
  var spectralChange2 = composite20142023.subtract(composite20042013); // Change from 2004-2013 to 2014-2023
  var totalSpectralChange = spectralChange1.add(spectralChange2); // Total change over 20 years
  var annualSpectralChange = totalSpectralChange.divide(20).select(bandNames); // Annual spectral change
  
  var yearsTo2033 = 2033 - 2023; // Years from 2023 to 2033
  var composite2033 = composite20142023.add(annualSpectralChange.multiply(yearsTo2033)).clip(geometry).select(bandNames); // Simulate 2033 composite
  
  // Train Random Forest classifier with combined training data
  var rfClassifier = ee.Classifier.smileRandomForest(50).train({
    features: combinedTraining,
    classProperty: 'landcover',
    inputProperties: bandNames
  });
  var classified2033 = composite2033.classify(rfClassifier); // Classify simulated 2033 image
  var predictedClassified2033 = ee.Image(1)
    .where(classified2033.eq(0), 0)
    .where(classified2033.eq(2), 2)
    .where(classified2033.eq(3), 3)
    .clip(geometry); // Remap classes
  
  // Add predicted 2033 classification to the map
  Map.addLayer(predictedClassified2033, {min: 0, max: 3, palette: palette}, 'Predicted 2024-2033'); // Renamed from 'Predicted 2033 1994-2023'
  var areas2033 = calculateAreas(predictedClassified2033, 'Predicted 2033 1994-2023'); // Calculate areas
  // Export predicted classification to Google Drive
  Export.image.toDrive({
    image: predictedClassified2033,
    description: 'Predicted_Classified_2033_Random_Forest_1994_2023',
    folder: 'jubaPredictionNew/Predictions',
    scale: 30,
    region: geometry,
    maxPixels: 1e13
  });
  
  // Return results for further use
  return {classified: predictedClassified2033, areas: areas2033, composite: composite2033};
}

// Run the prediction function
var result1994_2023 = predictUsing1994_2023();

// Create historical areas collection for charting
var historicalAreas = ee.FeatureCollection([
  ee.Feature(null, {year: 2003, urban: areas2003.urban, bare: areas2003.bare, water: areas2003.water, vegetation: areas2003.vegetation, total: areas2003.total}),
  ee.Feature(null, {year: 2013, urban: areas2013.urban, bare: areas2013.bare, water: areas2013.water, vegetation: areas2013.vegetation, total: areas2013.total}),
  ee.Feature(null, {year: 2023, urban: areas2023.urban, bare: areas2023.bare, water: areas2023.water, vegetation: areas2023.vegetation, total: areas2023.total})
]);
var years2023to2033 = 2033 - 2023; // Years for prediction period
var growthRates2033 = calculateGrowthRates(areas2023, result1994_2023.areas, years2023to2033); // Calculate growth rates

// Function to compute annual growth rates between two periods
function calculateGrowthRates(areasEarlier, areasLater, years) {
  var urbanGrowth = ee.Number(areasLater.urban).subtract(areasEarlier.urban).divide(years); // Urban growth rate
  var bareGrowth = ee.Number(areasLater.bare).subtract(areasEarlier.bare).divide(years); // Bare growth rate
  var waterGrowth = ee.Number(areasLater.water).subtract(areasEarlier.water).divide(years); // Water growth rate
  var vegetationGrowth = ee.Number(areasLater.vegetation).subtract(areasEarlier.vegetation).divide(years); // Vegetation growth rate
  return {urban: urbanGrowth, bare: bareGrowth, water: waterGrowth, vegetation: vegetationGrowth};
}

// Generate predicted areas for 2024-2033
var predictionYears = ee.List.sequence(2024, 2033); // List of years from 2024 to 2033
var predictedAreas = predictionYears.map(function(year) {
  var yearsFrom2023 = ee.Number(year).subtract(2023); // Years from 2023
  var urban = ee.Number(areas2023.urban).add(growthRates2033.urban.multiply(yearsFrom2023)).max(0); // Predicted urban area
  var bare = ee.Number(areas2023.bare).add(growthRates2033.bare.multiply(yearsFrom2023)).max(0); // Predicted bare area
  var water = ee.Number(areas2023.water).add(growthRates2033.water.multiply(yearsFrom2023)).max(0); // Predicted water area
  var vegetation = ee.Number(areas2023.vegetation).add(growthRates2033.vegetation.multiply(yearsFrom2023)).max(0); // Predicted vegetation area
  var total = urban.add(bare).add(water).add(vegetation); // Total predicted area
  return ee.Feature(null, {year: year, urban: urban, bare: bare, water: water, vegetation: vegetation, total: total});
});

var predictedAreasCollection = ee.FeatureCollection(predictedAreas); // Convert predicted areas to feature collection
var allAreasCollection = historicalAreas.merge(predictedAreasCollection); // Combine historical and predicted areas
print('All Areas (2003-2033) - 1994-2023:', allAreasCollection); // Print combined areas
Export.table.toDrive({collection: allAreasCollection, description: 'All_Areas_2003_2033_Random_Forest_1994_2023', folder: 'jubaPredictionNew/Predictions', fileFormat: 'CSV'}); // Export areas

// Print area comparison across all periods
print('Area Comparison (sq km):', {
  '2003 Urban': areas2003.urban, '2003 Bare': areas2003.bare, '2003 Water': areas2003.water, '2003 Vegetation': areas2003.vegetation,
  '2013 Urban': areas2013.urban, '2013 Bare': areas2013.bare, '2013 Water': areas2013.water, '2013 Vegetation': areas2013.vegetation,
  '2023 Urban': areas2023.urban, '2023 Bare': areas2023.bare, '2023 Water': areas2023.water, '2023 Vegetation': areas2023.vegetation,
  '2033 Urban': result1994_2023.areas.urban, '2033 Bare': result1994_2023.areas.bare, '2033 Water': result1994_2023.areas.water, '2033 Vegetation': result1994_2023.areas.vegetation
});
print('Composite 2014-2023 Bands:', composite20142023.bandNames()); // Print bands in 2014-2023 composite
print('Simulated 2033 Bands:', result1994_2023.composite.bandNames()); // Print bands in simulated 2033 composite
print('Composite 2014-2023 (sample):', composite20142023.reduceRegion({reducer: ee.Reducer.mean(), geometry: geometry, scale: 30, tileScale: 15, maxPixels: 1e13})); // Sample 2014-2023 values
print('Simulated 2033 (sample):', result1994_2023.composite.reduceRegion({reducer: ee.Reducer.mean(), geometry: geometry, scale: 30, tileScale: 15, maxPixels: 1e13})); // Sample 2033 values
print('Growth Rates 2023-2033 (sq km/year):', growthRates2033); // Print predicted growth rates

// Confusion Matrix and Chart Feeds Section
// Function to classify and generate confusion matrix without adding redundant layers
function classifyAndGetConfusionMatrix(composite, training, period) {
  var rfClassifier = ee.Classifier.smileRandomForest(50).train({features: training, classProperty: 'landcover', inputProperties: bandNames}); // Train classifier
  var classifiedTemp = composite.classify(rfClassifier); // Temporary classification
  // Removed Map.addLayer(classifiedTemp, ...) to avoid redundancy
  var classified = ee.Image(1).where(classifiedTemp.eq(0), 0).where(classifiedTemp.eq(2), 2).where(classifiedTemp.eq(3), 3).clip(geometry); // Remap classes
  // Removed Map.addLayer(classified, ...) to avoid redundancy
  var validation = composite.classify(rfClassifier).sampleRegions({collection: gcps2003, properties: ['landcover'], scale: 30, tileScale: 15}); // Validate with 2003 GCPs
  var confusionMatrix = validation.errorMatrix('landcover', 'classification'); // Compute confusion matrix
  return {classified: classified, confusionMatrix: confusionMatrix}; // Return results
}

// Generate confusion matrices and classified images for chart feeds
var result19942003 = classifyAndGetConfusionMatrix(composite19942003, training2003, '1994-2003');
var cm19942003 = result19942003.confusionMatrix; // Confusion matrix for 1994-2003
var classified19942003 = result19942003.classified; // Classified image

var result20042013 = classifyAndGetConfusionMatrix(composite20042013, training2013, '2004-2013');
var cm20042013 = result20042013.confusionMatrix; // Confusion matrix for 2004-2013
var classified20042013 = result20042013.classified; // Classified image

var areas2003 = calculateAreas(classified19942003, '1994-2003'); // Recalculate areas for consistency
var areas2013 = calculateAreas(classified20042013, '2004-2013');
var areas2023 = calculateAreas(result20142023.classified, '2014-2023');

var combinedTraining = training2003.merge(training2013).merge(training2023); // Combine all training data
var spectralChange1 = composite20042013.subtract(composite19942003); // Spectral change 1994-2003 to 2004-2013
var spectralChange2 = composite20142023.subtract(composite20042013); // Spectral change 2004-2013 to 2014-2023
var totalSpectralChange = spectralChange1.add(spectralChange2); // Total change
var annualSpectralChange = totalSpectralChange.divide(20).select(bandNames); // Annual change
var years2023to2033 = 2033 - 2023; // Prediction period
var composite2033 = composite20142023.add(annualSpectralChange.multiply(years2023to2033)).clip(geometry).select(bandNames); // Simulated 2033 composite
var rfClassifier2033 = ee.Classifier.smileRandomForest(50).train({features: combinedTraining, classProperty: 'landcover', inputProperties: bandNames}); // Train classifier
var classified2033 = composite2033.classify(rfClassifier2033); // Classify 2033
var predictedClassified2033 = ee.Image(1).where(classified2033.eq(0), 0).where(classified2033.eq(2), 2).where(classified2033.eq(3), 3).clip(geometry); // Remap classes
var areas2033 = calculateAreas(predictedClassified2033, '2024-2033'); // Calculate 2033 areas

// Recreate historical areas with recalculated values
var historicalAreas = ee.FeatureCollection([
  ee.Feature(null, {year: 2003, urban: areas2003.urban, bare: areas2003.bare, water: areas2003.water, vegetation: areas2003.vegetation, total: areas2003.total}),
  ee.Feature(null, {year: 2013, urban: areas2013.urban, bare: areas2013.bare, water: areas2013.water, vegetation: areas2013.vegetation, total: areas2013.total}),
  ee.Feature(null, {year: 2023, urban: areas2023.urban, bare: areas2023.bare, water: areas2023.water, vegetation: areas2023.vegetation, total: areas2023.total})
]);
var growthRates2033 = {
  urban: ee.Number(areas2033.urban).subtract(areas2023.urban).divide(years2023to2033), // Urban growth rate 2023-2033
  bare: ee.Number(areas2033.bare).subtract(areas2023.bare).divide(years2023to2033), // Bare growth rate
  water: ee.Number(areas2033.water).subtract(areas2023.water).divide(years2023to2033), // Water growth rate
  vegetation: ee.Number(areas2033.vegetation).subtract(areas2023.vegetation).divide(years2023to2033) // Vegetation growth rate
};
var predictionYears = ee.List.sequence(2024, 2033); // Prediction years
var predictedAreas = predictionYears.map(function(year) {
  var yearsFrom2023 = ee.Number(year).subtract(2023);
  var urban = ee.Number(areas2023.urban).add(growthRates2033.urban.multiply(yearsFrom2023)).max(0);
  var bare = ee.Number(areas2023.bare).add(growthRates2033.bare.multiply(yearsFrom2023)).max(0);
  var water = ee.Number(areas2023.water).add(growthRates2033.water.multiply(yearsFrom2023)).max(0);
  var vegetation = ee.Number(areas2023.vegetation).add(growthRates2033.vegetation.multiply(yearsFrom2023)).max(0);
  var total = urban.add(bare).add(water).add(vegetation);
  return ee.Feature(null, {year: year, urban: urban, bare: bare, water: water, vegetation: vegetation, total: total});
});
var allAreasCollection = historicalAreas.merge(ee.FeatureCollection(predictedAreas)); // Combine for charting

// Define chart axis limits based on ROI area
var maxArea = roiArea.ceil().divide(100).multiply(100); // Round up to nearest 100
var yTicks = ee.List.sequence(0, maxArea, maxArea.divide(5)); // Y-axis ticks
var minY = Math.min.apply(null, yTicks) * 0.95; // Slightly below min for buffer
var maxY = Math.max.apply(null, yTicks) * 1.05; // Slightly above max for buffer

// Create a time series line chart of land cover areas
var timeSeriesChart = ui.Chart.feature.byFeature({features: allAreasCollection, xProperty: 'year', yProperties: ['urban', 'bare', 'water', 'vegetation']})
  .setChartType('LineChart')
  .setOptions({
    title: 'Land Cover Area Over Time (1994-2033)', 
    titleTextStyle: {color: '#000000', fontSize: 28, bold: true}, 
    titlePosition: 'center', 
    height: '400px', 
    width: '600px',
    hAxis: {title: 'Year', titleTextStyle: {color: '#000000', fontSize: 24, bold: true}, textStyle: {color: '#000000', fontSize: 20, bold: true}, format: '####', ticks: ['2003', '2008', '2013', 2018, 2023, 2028, 2033], slantedText: true, slantedTextAngle: 30},
    vAxis: {title: 'Area (sq km)', titleTextStyle: {color: '#000000', fontSize: 24, bold: true}, textStyle: {color: '#000000', fontSize: 20, bold: true}, format: 'decimal', ticks: yTicks, titleOffset: 20, viewWindow: {min: minY, max: maxY}},
    chartArea: {left: 100, top: 120, bottom: 100, width: '80%', height: '65%'},
    legend: {position: 'top', textStyle: {color: '#000000', fontSize: 26, bold: true}, alignment: 'end', maxLines: 1, width: '100%'},
    colors: ['#6f2e01', '#c09272', '#c3f1d5', '#566e6b'], 
    lineWidth: 10
  });
print(timeSeriesChart); // Display chart
Export.table.toDrive({collection: allAreasCollection, description: 'Time_Series_Data_1994_2033', folder: 'jubaPredictionNew/Charts', fileFormat: 'CSV'}); // Export chart data

// Prepare data for bar charts
var barChartData = ee.FeatureCollection([
  ee.Feature(null, {year: '1994-2003', urban: areas2003.urban, bare: areas2003.bare, water: areas2003.water, vegetation: areas2003.vegetation}),
  ee.Feature(null, {year: '2004-2013', urban: areas2013.urban, bare: areas2013.bare, water: areas2013.water, vegetation: areas2013.vegetation}),
  ee.Feature(null, {year: '2014-2023', urban: areas2023.urban, bare: areas2023.bare, water: areas2023.water, vegetation: areas2023.vegetation}),
  ee.Feature(null, {year: '2024-2033', urban: areas2033.urban, bare: areas2033.bare, water: areas2033.water, vegetation: areas2033.vegetation})
]);

// Create a column bar chart
var barChart = ui.Chart.feature.byFeature({features: barChartData, xProperty: 'year', yProperties: ['urban', 'bare', 'water', 'vegetation']})
  .setChartType('ColumnChart')
  .setOptions({
    title: 'Land Cover Areas: 1994-2003, 2004-2013, 2014-2023, 2024-2033', 
    titleTextStyle: {color: '#000000', fontSize: 28, bold: true}, 
    titlePosition: 'center', 
    height: 300, 
    width: 600,
    hAxis: {title: 'Period', titleTextStyle: {color: '#000000', fontSize: 24, bold: true}, textStyle: {color: '#000000', fontSize: 20, bold: true}, ticks: ['1994-2003', '2004-2013', '2014-2023', '2024-2033'], slantedText: true, slantedTextAngle: 30},
    vAxis: {title: 'Area (sq km)', titleTextStyle: {color: '#000000', fontSize: 24, bold: true}, textStyle: {color: '#000000', fontSize: 20, bold: true}, format: 'decimal', ticks: yTicks, titleOffset: 20, viewWindow: {min: minY, max: maxY}},
    chartArea: {left: 100, top: 120, bottom: 100, width: '80%', height: '65%'},
    legend: {position: 'top', textStyle: {color: '#000000', fontSize: 26, bold: true}, alignment: 'end', maxLines: 1, width: '100%'},
    colors: ['#6f2e01', '#c09272', '#c3f1d5', '#566e6b'], 
    bar: {groupWidth: '85%'}
  });
print(barChart); // Display chart
Export.table.toDrive({collection: barChartData, description: 'Bar_Chart_Data_1994_2033', folder: 'jubaPredictionNew/Charts', fileFormat: 'CSV'}); // Export chart data

// Create a stacked bar chart
var stackedBarChart = ui.Chart.feature.byFeature({features: barChartData, xProperty: 'year', yProperties: ['urban', 'bare', 'water', 'vegetation']})
  .setChartType('ColumnChart')
  .setOptions({
    title: 'Stacked Land Cover Areas: 1994-2003, 2004-2013, 2014-2023, 2024-2033', 
    titleTextStyle: {color: '#000000', fontSize: 28, bold: true}, 
    titlePosition: 'center', 
    height: 400, 
    width: 600,
    hAxis: {title: 'Period', titleTextStyle: {color: '#000000', fontSize: 24, bold: true}, textStyle: {color: '#000000', fontSize: 20, bold: true}, ticks: ['1994-2003', '2004-2013', '2014-2023', '2024-2033'], slantedText: true, slantedTextAngle: 30},
    vAxis: {title: 'Area (sq km)', titleTextStyle: {color: '#000000', fontSize: 24, bold: true}, textStyle: {color: '#000000', fontSize: 20, bold: true}, format: 'decimal', ticks: yTicks, titleOffset: 20, viewWindow: {min: minY, max: maxY}},
    chartArea: {left: 100, top: 120, bottom: 100, width: '80%', height: '65%'},
    legend: {position: 'top', textStyle: {color: '#000000', fontSize: 26, bold: true}, alignment: 'center', maxLines: 1, width: '100%'},
    isStacked: true, 
    colors: ['#6f2e01', '#c09272', '#c3f1d5', '#566e6b'], 
    bar: {groupWidth: '85%'}
  });
print(stackedBarChart); // Display chart
Export.table.toDrive({collection: barChartData, description: 'Stacked_Bar_Chart_Data_1994_2033', folder: 'jubaPredictionNew/Charts', fileFormat: 'CSV'}); // Export chart data

// Function to create pie charts for land cover distribution
function createPieChart(areas, period) {
  var urban = ee.Number(areas.urban || 0); // Ensure urban area is a number, default to 0 if null
  var bare = ee.Number(areas.bare || 0); // Bare area
  var water = ee.Number(areas.water || 0); // Water area
  var vegetation = ee.Number(areas.vegetation || 0); // Vegetation area
  var total = urban.add(bare).add(water).add(vegetation); // Total area
  // Calculate percentages for each class, default to 0 if total is 0
  var urbanPercentage = total.gt(0) ? urban.divide(total).multiply(100) : ee.Number(0);
  var barePercentage = total.gt(0) ? bare.divide(total).multiply(100) : ee.Number(0);
  var waterPercentage = total.gt(0) ? water.divide(total).multiply(100) : ee.Number(0);
  var vegetationPercentage = total.gt(0) ? vegetation.divide(total).multiply(100) : ee.Number(0);
  // Create labels with percentages
  var labelsWithPercentages = [
    'Urban ' + urbanPercentage.format('%.1f').getInfo() + '%',
    'Bare ' + barePercentage.format('%.1f').getInfo() + '%',
    'Water ' + waterPercentage.format('%.1f').getInfo() + '%',
    'Vegetation ' + vegetationPercentage.format('%.1f').getInfo() + '%'
  ];
  // Define pie chart
  var pieChart = ui.Chart.array.values({array: ee.List([urban, bare, water, vegetation]), axis: 0, xLabels: labelsWithPercentages})
    .setChartType('PieChart')
    .setOptions({
      title: 'Land Cover Distribution ' + period, 
      titleTextStyle: {color: '#000000', fontSize: 28, bold: true}, 
      height: '200px', 
      width: '200px',
      chartArea: {top: 40, width: '50%'}, 
      colors: ['#6f2e01', '#c09272', '#c3f1d5', '#566e6b'],
      pieSliceTextStyle: {color: '#FFFFFF', fontSize: 24, bold: true},
      legend: {position: 'left', alignment: 'center', width: '100%', textStyle: {color: '#000000', fontSize: 26, bold: true}, labels: labelsWithPercentages},
      slices: {0: {textStyle: {angle: 45}}, 1: {textStyle: {angle: 45}}, 2: {textStyle: {angle: 45}}, 3: {textStyle: {angle: 45}}}
    });
  print(pieChart); // Display pie chart
}

// Generate pie charts for each period
createPieChart(areas2003, '1994-2003');
createPieChart(areas2013, '2004-2013');
createPieChart(areas2023, '2014-2023');
createPieChart(areas2033, '2024-2033');

// Create a bar chart of growth rates for 2023-2033
var growthRateChart = ui.Chart.array.values({
  array: ee.List([growthRates2033.urban, growthRates2033.bare, growthRates2033.water, growthRates2033.vegetation]), 
  axis: 0, 
  xLabels: ['Urban', 'Bare', 'Water', 'Vegetation']
})
  .setChartType('ColumnChart')
  .setOptions({
    title: 'Land Cover Growth Rates (2023-2033)',
    height: '400px', 
    width: '600px',
    hAxis: {title: 'Land Cover Class', titleTextStyle: {color: '#000000', fontSize: 18}, textStyle: {color: '#000000', fontSize: 14}, ticks: ['Urban', 'Bare', 'Water', 'Vegetation']},
    vAxis: {title: 'Growth Rate (sq km/year)', titleTextStyle: {color: '#000000', fontSize: 18}, textStyle: {color: '#000000', fontSize: 14}, format: 'decimal', ticks: [-10, -5, 0, 5, 10, 15, 20]},
    legend: {position: 'none'}, 
    colors: ['#6f2e01', '#c09272', '#c3f1d5', '#566e6b'], 
    bar: {groupWidth: '80%'}
  });
print(growthRateChart); // Display chart
Export.table.toDrive({
  collection: ee.FeatureCollection([ee.Feature(null, {'Urban': growthRates2033.urban, 'Bare': growthRates2033.bare, 'Water': growthRates2033.water, 'Vegetation': growthRates2033.vegetation})]), 
  description: 'Growth_Rate_Data_2023_2033',
  folder: 'jubaPredictionNew/Charts', 
  fileFormat: 'CSV'
}); // Export chart data

// Create confusion matrix charts
var cmChart19942003 = ui.Chart.array.values({array: cm19942003.array(), axis: 0, xLabels: ['Urban', 'Bare', 'Water', 'Vegetation']})
  .setChartType('Table')
  .setOptions({
    title: 'Confusion Matrix (1994-2003)', 
    height: '300px', 
    width: '300px', 
    hAxis: {title: 'Predicted', titleTextStyle: {color: '#000000', fontSize: 18}, textStyle: {color: '#000000', fontSize: 14}}, 
    vAxis: {title: 'Actual', titleTextStyle: {color: '#000000', fontSize: 18}, textStyle: {color: '#000000', fontSize: 14}}
  });
print(cmChart19942003); // Display 1994-2003 confusion matrix

var cmChart20042013 = ui.Chart.array.values({array: cm20042013.array(), axis: 0, xLabels: ['Urban', 'Bare', 'Water', 'Vegetation']})
  .setChartType('Table')
  .setOptions({
    title: 'Confusion Matrix (2004-2013)', 
    height: '300px', 
    width: '300px', 
    hAxis: {title: 'Predicted', titleTextStyle: {color: '#000000', fontSize: 18}, textStyle: {color: '#000000', fontSize: 14}}, 
    vAxis: {title: 'Actual', titleTextStyle: {color: '#000000', fontSize: 18}, textStyle: {color: '#000000', fontSize: 14}}
  });
print(cmChart20042013); // Display 2004-2013 confusion matrix

var cmChart20142023 = ui.Chart.array.values({array: result20142023.confusionMatrix.array(), axis: 0, xLabels: ['Urban', 'Bare', 'Water', 'Vegetation']})
  .setChartType('Table')
  .setOptions({
    title: 'Confusion Matrix (2014-2023)', 
    height: '300px', 
    width: '300px', 
    hAxis: {title: 'Predicted', titleTextStyle: {color: '#000000', fontSize: 18}, textStyle: {color: '#000000', fontSize: 14}}, 
    vAxis: {title: 'Actual', titleTextStyle: {color: '#000000', fontSize: 18}, textStyle: {color: '#000000', fontSize: 14}}
  });
print(cmChart20142023); // Display 2014-2023 confusion matrix

// Export all confusion matrices as a CSV
Export.table.toDrive({
  collection: ee.FeatureCollection([
    ee.Feature(null, {matrix: cm19942003.array(), period: '1994-2003'}),
    ee.Feature(null, {matrix: cm20042013.array(), period: '2004-2013'}),
    ee.Feature(null, {matrix: result20142023.confusionMatrix.array(), period: '2014-2023'})
  ]), 
  description: 'Confusion_Matrices_1994_2023', 
  folder: 'jubaPredictionNew/Charts', 
  fileFormat: 'CSV'
});