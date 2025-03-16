// Define the study area (ROI)
var juba = table2;
var geometry = juba.geometry();

// Add the ROI geometry to the map
Map.addLayer(geometry, {color: '#008080'}, 'ROI - Juba');
Map.centerObject(geometry, 10); 

// --- Export ROI Juba as Shapefile ---
Export.table.toDrive({
 collection: juba,
 description: 'ROI_Juba',
 folder: 'jubaPrediction/Roi',
 fileFormat: 'SHP'
});

// --- Calculate and Print Total ROI Area ---
var roiArea = geometry.area({maxError: 1}).divide(1e6);
print('Total ROI Area (sq km):', roiArea.format('%.2f'));

// Function to apply scale factors
function applyScaleFactors(image) {
 var opticalBands = image.select(['SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B7'])
 .multiply(0.0000275).add(-0.2);
 var thermalBand = image.select('ST_B6').multiply(0.00341802).add(149.0);
 return image.addBands(opticalBands, null, true)
 .addBands(thermalBand, null, true);
}

// Cloud mask function
function maskClouds(image) {
 var cloudMask = image.select('QA_PIXEL').bitwiseAnd(1 << 3).eq(0);
 var shadowMask = image.select('QA_PIXEL').bitwiseAnd(1 << 4).eq(0);
 return image.updateMask(cloudMask).updateMask(shadowMask);
}

// Define palette for 4 landcovers
var palette = ['#FFFF00', '#A9A9A9', '#00CED1 ', '#006400']; // Urban (yellow), Bare (gray), Water (turquoise), Vegetation (dark green)
var paletteList = ee.List(palette);
var landcoverClasses = ee.List([0, 1, 2, 3]); // Urban (0), Bare (1), Water (2), Vegetation (3)

// Function to calculate areas with tileScale
function calculateAreas(image, period) {
 var pixelArea = ee.Image.pixelArea().divide(1e6);
 var urbanArea = pixelArea.updateMask(image.eq(0)).reduceRegion({
 reducer: ee.Reducer.sum(),
 geometry: geometry,
 scale: 30,
 tileScale: 15,
 maxPixels: 1e13
 }).get('area');
 
 var bareArea = pixelArea.updateMask(image.eq(1)).reduceRegion({
 reducer: ee.Reducer.sum(),
 geometry: geometry,
 scale: 30,
 tileScale: 15,
 maxPixels: 1e13
 }).get('area');
 
 var waterArea = pixelArea.updateMask(image.eq(2)).reduceRegion({
 reducer: ee.Reducer.sum(),
 geometry: geometry,
 scale: 30,
 tileScale: 15,
 maxPixels: 1e13
 }).get('area');
 
 var vegetationArea = pixelArea.updateMask(image.eq(3)).reduceRegion({
 reducer: ee.Reducer.sum(),
 geometry: geometry,
 scale: 30,
 tileScale: 15,
 maxPixels: 1e13
 }).get('area');
 
 print('Urban Area ' + period + ' (sq km):', ee.Number(urbanArea).format('%.2f'));
 print('Bare Area ' + period + ' (sq km):', ee.Number(bareArea).format('%.2f'));
 print('Water Area ' + period + ' (sq km):', ee.Number(waterArea).format('%.2f'));
 print('Vegetation Area ' + period + ' (sq km):', ee.Number(vegetationArea).format('%.2f'));
 
 var totalArea = ee.Number(urbanArea).add(bareArea).add(waterArea).add(vegetationArea);
 print('Total Area ' + period + ' (sq km):', totalArea.format('%.2f'));
 
 return {
 urban: urbanArea,
 bare: bareArea,
 water: waterArea,
 vegetation: vegetationArea,
 total: totalArea
 };
}

// Function to classify and remap
function classifyAndRemap(composite, training, period) {
 var rfClassifier = ee.Classifier.smileRandomForest(50).train({
 features: training,
 classProperty: 'landcover',
 inputProperties: composite.bandNames()
 });

 var classifiedTemp = composite.classify(rfClassifier);
 Map.addLayer(classifiedTemp, {min: 0, max: 3, palette: palette}, period + ' Random Forest Temp');
 
 var classified = ee.Image(1).where(classifiedTemp.eq(0), 0) // Urban
 .where(classifiedTemp.eq(2), 2) // Water
 .where(classifiedTemp.eq(3), 3) // Vegetation
 .clip(geometry); // Bare (1) by default, including unclassified
 
 Map.addLayer(classified, {min: 0, max: 3, palette: palette}, period + ' Random Forest');

 var validation = composite.classify(rfClassifier).sampleRegions({
 collection: gcps2003,
 properties: ['landcover'],
 scale: 30,
 tileScale: 8
 });
 
 var confusionMatrix = validation.errorMatrix('landcover', 'classification');
 var overallAccuracy = confusionMatrix.accuracy();
 var producersAccuracy = confusionMatrix.producersAccuracy();
 var consumersAccuracy = confusionMatrix.consumersAccuracy();

 print(period + ' Confusion Matrix:', confusionMatrix);
 print(period + ' Overall Accuracy:', overallAccuracy.format('%.2f'));
 print(period + ' Producer\'s Accuracy (Urban, Bare, Water, Vegetation):', producersAccuracy);
 print(period + ' Consumer\'s Accuracy (Urban, Bare, Water, Vegetation):', consumersAccuracy);
 
 var areas = calculateAreas(classified, 'Random Forest ' + period);
 
 Export.image.toDrive({
 image: classified,
 description: 'Classified_' + period.replace(' ', '_') + '_Random_Forest',
 folder: 'jubaPrediction/' + period.replace(' ', ''),
 scale: 30,
 region: geometry,
 maxPixels: 1e13
 });
 
 return {classified: classified, areas: areas};
}

// Training data (same for all periods)
var gcps2003 = urban2003.merge(bare2003).merge(water2003).merge(vegetation2003);

// 1994 - 2003
var dataset19942003 = ee.ImageCollection('LANDSAT/LT05/C02/T1_L2')
 .filterDate('1994-01-01', '2003-12-31')
 .filterBounds(geometry);

print('Number of Landsat 5 images (1994-2003):', dataset19942003.size());

var scaledDataset19942003 = dataset19942003.map(applyScaleFactors);
var maskedDataset19942003 = scaledDataset19942003.map(maskClouds);
var composite19942003 = maskedDataset19942003.median().clip(geometry);

var training2003 = composite19942003.sampleRegions({
 collection: gcps2003, 
 properties: ['landcover'], 
 scale: 30,
 tileScale: 8
}).filter(ee.Filter.notNull(composite19942003.bandNames().add('landcover')));

print('Number of training samples (1994-2003):', training2003.size());
print('Sample training data (1994-2003):', training2003.limit(5));

Map.addLayer(composite19942003, {bands: ['SR_B3', 'SR_B2', 'SR_B1'], min: 0.0, max: 0.3}, 'Collection (1994-2003)');
var result2003 = classifyAndRemap(composite19942003, training2003, '1994-2003');
var classified2003 = result2003.classified;
var areas2003 = result2003.areas;

Export.image.toDrive({
 image: composite19942003,
 description: 'Collection_1994_2003',
 folder: 'jubaPrediction/19942003',
 scale: 30,
 region: geometry,
 maxPixels: 1e13
});

// 2004 - 2013
var dataset20042013 = ee.ImageCollection('LANDSAT/LE07/C02/T1_L2')
 .filterDate('2004-01-01', '2013-12-31')
 .filterBounds(geometry);

print('Number of Landsat 7 images (2004-2013):', dataset20042013.size());

var scaledDataset20042013 = dataset20042013.map(applyScaleFactors);
var maskedDataset20042013 = scaledDataset20042013.map(maskClouds);
var composite20042013 = maskedDataset20042013.median().clip(geometry);

var training2013 = composite20042013.sampleRegions({
 collection: gcps2003, 
 properties: ['landcover'], 
 scale: 30,
 tileScale: 8
}).filter(ee.Filter.notNull(composite20042013.bandNames().add('landcover')));

print('Number of training samples (2004-2013):', training2013.size());
print('Sample training data (2004-2013):', training2013.limit(5));

Map.addLayer(composite20042013, {bands: ['SR_B3', 'SR_B2', 'SR_B1'], min: 0.0, max: 0.3}, 'Collection (2004-2013)');
var result2013 = classifyAndRemap(composite20042013, training2013, '2004-2013');
var classified2013 = result2013.classified;
var areas2013 = result2013.areas;

Export.image.toDrive({
 image: composite20042013,
 description: 'Collection_2004_2013',
 folder: 'jubaPrediction/20042013',
 scale: 30,
 region: geometry,
 maxPixels: 1e13
});

// 2014 - 2024
var dataset20142024 = ee.ImageCollection('LANDSAT/LE07/C02/T1_L2')
 .filterDate('2014-01-01', '2024-03-16') // Current date: March 16, 2025
 .filterBounds(geometry);

print('Number of Landsat 7 images (2014-2024):', dataset20142024.size());

var scaledDataset20142024 = dataset20142024.map(applyScaleFactors);
var maskedDataset20142024 = scaledDataset20142024.map(maskClouds);
var composite20142024 = maskedDataset20142024.median().clip(geometry);

var training2023 = composite20142024.sampleRegions({
 collection: gcps2003, 
 properties: ['landcover'], 
 scale: 30,
 tileScale: 8
}).filter(ee.Filter.notNull(composite20142024.bandNames().add('landcover')));

print('Number of training samples (2014-2024):', training2023.size());
print('Sample training data (2014-2024):', training2023.limit(5));

Map.addLayer(composite20142024, {bands: ['SR_B3', 'SR_B2', 'SR_B1'], min: 0.0, max: 0.3}, 'Collection (2014-2024)');
var result2023 = classifyAndRemap(composite20142024, training2023, '2014-2024');
var classified2023 = result2023.classified;
var areas2023 = result2023.areas;

Export.image.toDrive({
 image: composite20142024,
 description: 'Collection_2014_2024',
 folder: 'jubaPrediction/20142024',
 scale: 30,
 region: geometry,
 maxPixels: 1e13
});

// Display GCPs (using 1994-2003 as reference for visualization)
var gcpsStyled = ee.FeatureCollection(
 landcoverClasses.map(function(lc) {
 var color = paletteList.get(landcoverClasses.indexOf(lc));
 var markerStyle = { color: 'white', pointShape: 'diamond', pointSize: 4, width: 1, fillColor: color};
 return gcps2003.filter(ee.Filter.eq('landcover', lc))
 .map(function(point) { return point.set('style', markerStyle); });
 })).flatten();
Map.addLayer(gcpsStyled.style({styleProperty: "style"}), {}, 'GCPs 1994-2003');

// Calculate historical urban growth rate
var years2003to2013 = 2013 - 2003; // 10 years
var years2013to2023 = 2023 - 2013; // 10 years
var urbanGrowth2003to2013 = ee.Number(areas2013.urban).subtract(areas2003.urban).divide(years2003to2013);
var urbanGrowth2013to2023 = ee.Number(areas2023.urban).subtract(areas2013.urban).divide(years2013to2023);
var avgUrbanGrowthRate = urbanGrowth2003to2013.add(urbanGrowth2013to2023).divide(2);

print('Urban Growth Rate 2003-2013 (sq km/year):', urbanGrowth2003to2013.format('%.2f'));
print('Urban Growth Rate 2013-2023 (sq km/year):', urbanGrowth2013to2023.format('%.2f'));
print('Average Urban Growth Rate (sq km/year):', avgUrbanGrowthRate.format('%.2f'));





























// [Your existing code remains unchanged up to the point of calculating historical urban growth rate]
// [Your existing code up to the 2014-2024 classification remains unchanged]

// Define band names globally and enforce from the start
var bandNames = ['SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B7', 'ST_B6'];

// 1994-2003 (ensure only 7 bands)
var dataset19942003 = ee.ImageCollection('LANDSAT/LT05/C02/T1_L2')
  .filterDate('1994-01-01', '2003-12-31')
  .filterBounds(geometry);
var scaledDataset19942003 = dataset19942003.map(applyScaleFactors);
var maskedDataset19942003 = scaledDataset19942003.map(maskClouds);
var composite19942003 = maskedDataset19942003.median().select(bandNames).clip(geometry);

// 2004-2013 (ensure only 7 bands)
var dataset20042013 = ee.ImageCollection('LANDSAT/LE07/C02/T1_L2')
  .filterDate('2004-01-01', '2013-12-31')
  .filterBounds(geometry);
var scaledDataset20042013 = dataset20042013.map(applyScaleFactors);
var maskedDataset20042013 = scaledDataset20042013.map(maskClouds);
var composite20042013 = maskedDataset20042013.median().select(bandNames).clip(geometry);

// Training data
var training2003 = composite19942003.sampleRegions({
  collection: gcps2003,
  properties: ['landcover'],
  scale: 30,
  tileScale: 8
}).filter(ee.Filter.notNull(bandNames.concat(['landcover'])));

var training2013 = composite20042013.sampleRegions({
  collection: gcps2003,
  properties: ['landcover'],
  scale: 30,
  tileScale: 8
}).filter(ee.Filter.notNull(bandNames.concat(['landcover'])));

// Prediction Function for 2003 & 2013
function predictUsing2003_2013() {
  var combinedTraining = training2003.merge(training2013);
  print('Number of training samples (2003 & 2013):', combinedTraining.size());
  print('Sample training data (2003 & 2013):', combinedTraining.limit(5));
  
  var spectralChange = composite20042013.subtract(composite19942003);
  var annualSpectralChange = spectralChange.divide(10).select(bandNames); // 10 years (1994-2013)
  
  var yearsTo2033 = 2033 - 2013; // 20 years from 2013
  var composite2033 = composite20042013.add(annualSpectralChange.multiply(yearsTo2033)).clip(geometry).select(bandNames);
  
  var rfClassifier = ee.Classifier.smileRandomForest(50).train({
    features: combinedTraining,
    classProperty: 'landcover',
    inputProperties: bandNames
  });
  
  var classified2033 = composite2033.classify(rfClassifier);
  var predictedClassified2033 = ee.Image(1) // Default to Bare
    .where(classified2033.eq(0), 0) // Urban
    .where(classified2033.eq(2), 2) // Water
    .where(classified2033.eq(3), 3) // Vegetation
    .clip(geometry);
  
  Map.addLayer(predictedClassified2033, {min: 0, max: 3, palette: palette}, 'Predicted 2033 2003 & 2013');
  var areas2033 = calculateAreas(predictedClassified2033, 'Predicted 2033 2003 & 2013');
  
  Export.image.toDrive({
    image: predictedClassified2033,
    description: 'Predicted_Classified_2033_Random_Forest_2003_2013',
    folder: 'jubaPrediction/Predictions',
    scale: 30,
    region: geometry,
    maxPixels: 1e13
  });
  
  return {classified: predictedClassified2033, areas: areas2033, composite: composite2033};
}

// Run the prediction
var result2003_2013 = predictUsing2003_2013();

// Interpolation for 2003 & 2013
var historicalAreas = ee.FeatureCollection([
  ee.Feature(null, {year: 2003, urban: areas2003.urban, bare: areas2003.bare, water: areas2003.water, vegetation: areas2003.vegetation, total: areas2003.total}),
  ee.Feature(null, {year: 2013, urban: areas2013.urban, bare: areas2013.bare, water: areas2013.water, vegetation: areas2013.vegetation, total: areas2013.total})
]);

var years2013to2033 = 2033 - 2013;
var growthRates2033 = calculateGrowthRates(areas2013, result2003_2013.areas, years2013to2033);

function calculateGrowthRates(areasEarlier, areasLater, years) {
  var urbanGrowth = ee.Number(areasLater.urban).subtract(areasEarlier.urban).divide(years);
  var bareGrowth = ee.Number(areasLater.bare).subtract(areasEarlier.bare).divide(years);
  var waterGrowth = ee.Number(areasLater.water).subtract(areasEarlier.water).divide(years);
  var vegetationGrowth = ee.Number(areasLater.vegetation).subtract(areasEarlier.vegetation).divide(years);
  return {urban: urbanGrowth, bare: bareGrowth, water: waterGrowth, vegetation: vegetationGrowth};
}

var predictionYears = ee.List.sequence(2014, 2033); // Start from 2014 to include full range
var predictedAreas = predictionYears.map(function(year) {
  var yearsFrom2013 = ee.Number(year).subtract(2013);
  var urban = ee.Number(areas2013.urban).add(growthRates2033.urban.multiply(yearsFrom2013));
  var bare = ee.Number(areas2013.bare).add(growthRates2033.bare.multiply(yearsFrom2013));
  var water = ee.Number(areas2013.water).add(growthRates2033.water.multiply(yearsFrom2013));
  var vegetation = ee.Number(areas2013.vegetation).add(growthRates2033.vegetation.multiply(yearsFrom2013));
  
  urban = urban.max(0);
  bare = bare.max(0);
  water = water.max(0);
  vegetation = vegetation.max(0);
  
  var total = urban.add(bare).add(water).add(vegetation);
  return ee.Feature(null, {year: year, urban: urban, bare: bare, water: water, vegetation: vegetation, total: total});
});

var predictedAreasCollection = ee.FeatureCollection(predictedAreas);
var allAreasCollection = historicalAreas.merge(predictedAreasCollection);
print('All Areas (2003-2033) - 2003 & 2013:', allAreasCollection);

Export.table.toDrive({
  collection: allAreasCollection,
  description: 'All_Areas_2003_2033_Random_Forest_2003_2013',
  folder: 'jubaPrediction/Predictions',
  fileFormat: 'CSV'
});

// Debug: Verify areas and spectral values
print('Area Comparison (sq km):', {
  '2003 Urban': areas2003.urban,
  '2003 Bare': areas2003.bare,
  '2003 Water': areas2003.water,
  '2003 Vegetation': areas2003.vegetation,
  '2013 Urban': areas2013.urban,
  '2013 Bare': areas2013.bare,
  '2013 Water': areas2013.water,
  '2013 Vegetation': areas2013.vegetation,
  '2033 Urban': result2003_2013.areas.urban,
  '2033 Bare': result2003_2013.areas.bare,
  '2033 Water': result2003_2013.areas.water,
  '2033 Vegetation': result2003_2013.areas.vegetation
});
print('Composite 2004-2013 Bands:', composite20042013.bandNames());
print('Simulated 2033 Bands:', result2003_2013.composite.bandNames());
print('Composite 2004-2013 (sample):', composite20042013.reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: geometry,
  scale: 30,
  tileScale: 15,
  maxPixels: 1e13
}));
print('Simulated 2033 (sample):', result2003_2013.composite.reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: geometry,
  scale: 30,
  tileScale: 15,
  maxPixels: 1e13
}));
print('Growth Rates 2013-2033 (sq km/year):', growthRates2033);




//charts
var timeSeriesChart = ui.Chart.feature.byFeature({
  features: allAreasCollection,
  xProperty: 'year',
  yProperties: ['urban', 'bare', 'water', 'vegetation']
})
.setChartType('LineChart')
.setOptions({
  title: 'Land Cover Area Over Time (2003-2033)',
  hAxis: {title: 'Year'},
  vAxis: {title: 'Area (sq km)'},
  legend: {position: 'bottom'},
  colors: ['#FFFF00', '#A9A9A9', '#00CED1', '#006400'] // Match palette: Urban, Bare, Water, Vegetation
});
print(timeSeriesChart);


var stackedAreaChart = ui.Chart.feature.byFeature({
  features: allAreasCollection,
  xProperty: 'year',
  yProperties: ['urban', 'bare', 'water', 'vegetation']
})
.setChartType('AreaChart')
.setOptions({
  title: 'Stacked Land Cover Area (2003-2033)',
  hAxis: {title: 'Year'},
  vAxis: {title: 'Area (sq km)'},
  isStacked: true,
  legend: {position: 'bottom'},
  colors: ['#FFFF00', '#A9A9A9', '#00CED1', '#006400']
});
print(stackedAreaChart);


var barChartData = ee.FeatureCollection([
  ee.Feature(null, {year: '2003', urban: areas2003.urban, bare: areas2003.bare, water: areas2003.water, vegetation: areas2003.vegetation}),
  ee.Feature(null, {year: '2013', urban: areas2013.urban, bare: areas2013.bare, water: areas2013.water, vegetation: areas2013.vegetation}),
  ee.Feature(null, {year: '2033', urban: result2003_2013.areas.urban, bare: result2003_2013.areas.bare, water: result2003_2013.areas.water, vegetation: result2003_2013.areas.vegetation})
]);

var barChart = ui.Chart.feature.byFeature({
  features: barChartData,
  xProperty: 'year',
  yProperties: ['urban', 'bare', 'water', 'vegetation']
})
.setChartType('ColumnChart')
.setOptions({
  title: 'Land Cover Areas: 2003, 2013, 2033',
  hAxis: {title: 'Year'},
  vAxis: {title: 'Area (sq km)'},
  legend: {position: 'bottom'},
  colors: ['#FFFF00', '#A9A9A9', '#00CED1', '#006400']
});
print(barChart);

var stackedBarChart = ui.Chart.feature.byFeature({
  features: barChartData,
  xProperty: 'year',
  yProperties: ['urban', 'bare', 'water', 'vegetation']
})
.setChartType('ColumnChart')
.setOptions({
  title: 'Stacked Land Cover Areas: 2003, 2013, 2033',
  hAxis: {title: 'Year'},
  vAxis: {title: 'Area (sq km)'},
  isStacked: true,
  legend: {position: 'bottom'},
  colors: ['#FFFF00', '#A9A9A9', '#00CED1', '#006400']
});
print(stackedBarChart);

var pieChart2033 = ui.Chart.array.values({
  array: ee.List([result2003_2013.areas.urban, result2003_2013.areas.bare, result2003_2013.areas.water, result2003_2013.areas.vegetation]),
  axis: 0,
  xLabels: ['Urban', 'Bare', 'Water', 'Vegetation']
})
.setChartType('PieChart')
.setOptions({
  title: 'Land Cover Distribution 2033',
  colors: ['#FFFF00', '#A9A9A9', '#00CED1', '#006400']
});
print(pieChart2033);

var growthRateChart = ui.Chart.array.values({
  array: ee.List([growthRates2033.urban, growthRates2033.bare, growthRates2033.water, growthRates2033.vegetation]),
  axis: 0,
  xLabels: ['Urban', 'Bare', 'Water', 'Vegetation']
})
.setChartType('ColumnChart')
.setOptions({
  title: 'Land Cover Growth Rates (2013-2033)',
  hAxis: {title: 'Land Cover Class'},
  vAxis: {title: 'Growth Rate (sq km/year)'},
  colors: ['#FFFF00', '#A9A9A9', '#00CED1', '#006400']
});
print(growthRateChart);







// Define the study area (ROI)
var juba = table2; // Replace with your actual ROI table if different
var geometry = juba.geometry();

// Define band names
var bandNames = ['SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B7', 'ST_B6'];

// Define palette for visualization (optional, for map layers)
var palette = ['#FFFF00', '#A9A9A9', '#00CED1', '#006400']; // Urban, Bare, Water, Vegetation

// Training data (combine GCPs)
var gcps2003 = urban2003.merge(bare2003).merge(water2003).merge(vegetation2003);

// Function to classify and compute confusion matrix
function classifyAndGetConfusionMatrix(composite, training, period) {
  var rfClassifier = ee.Classifier.smileRandomForest(50).train({
    features: training,
    classProperty: 'landcover',
    inputProperties: bandNames
  });

  var classifiedTemp = composite.classify(rfClassifier);
  var classified = ee.Image(1) // Default to Bare
    .where(classifiedTemp.eq(0), 0) // Urban
    .where(classifiedTemp.eq(2), 2) // Water
    .where(classifiedTemp.eq(3), 3) // Vegetation
    .clip(geometry);

  // Add to map for visual check (optional)
  Map.addLayer(classified, {min: 0, max: 3, palette: palette}, period + ' Random Forest');

  // Compute confusion matrix
  var validation = composite.classify(rfClassifier).sampleRegions({
    collection: gcps2003,
    properties: ['landcover'],
    scale: 30,
    tileScale: 8
  });
  
  var confusionMatrix = validation.errorMatrix('landcover', 'classification');
  
  return {classified: classified, confusionMatrix: confusionMatrix};
}

// 1994-2003
var dataset19942003 = ee.ImageCollection('LANDSAT/LT05/C02/T1_L2')
  .filterDate('1994-01-01', '2003-12-31')
  .filterBounds(geometry);
var scaledDataset19942003 = dataset19942003.map(applyScaleFactors);
var maskedDataset19942003 = scaledDataset19942003.map(maskClouds);
var composite19942003 = maskedDataset19942003.median().select(bandNames).clip(geometry);

var training2003 = composite19942003.sampleRegions({
  collection: gcps2003,
  properties: ['landcover'],
  scale: 30,
  tileScale: 15
}).filter(ee.Filter.notNull(bandNames.concat(['landcover'])));

var result19942003 = classifyAndGetConfusionMatrix(composite19942003, training2003, '1994-2003');
var cm19942003 = result19942003.confusionMatrix;

// 2004-2013
var dataset20042013 = ee.ImageCollection('LANDSAT/LE07/C02/T1_L2')
  .filterDate('2004-01-01', '2013-12-31')
  .filterBounds(geometry);
var scaledDataset20042013 = dataset20042013.map(applyScaleFactors);
var maskedDataset20042013 = scaledDataset20042013.map(maskClouds);
var composite20042013 = maskedDataset20042013.median().select(bandNames).clip(geometry);

var training2013 = composite20042013.sampleRegions({
  collection: gcps2003,
  properties: ['landcover'],
  scale: 30,
  tileScale: 15
}).filter(ee.Filter.notNull(bandNames.concat(['landcover'])));

var result20042013 = classifyAndGetConfusionMatrix(composite20042013, training2013, '2004-2013');
var cm20042013 = result20042013.confusionMatrix;

// 2014-2023 (adjusted from 2014-2024)
var dataset20142023 = ee.ImageCollection('LANDSAT/LE07/C02/T1_L2')
  .filterDate('2014-01-01', '2023-12-31') // Adjusted to 2023
  .filterBounds(geometry);
var scaledDataset20142023 = dataset20142023.map(applyScaleFactors);
var maskedDataset20142023 = scaledDataset20142023.map(maskClouds);
var composite20142023 = maskedDataset20142023.median().select(bandNames).clip(geometry);

var training2023 = composite20142023.sampleRegions({
  collection: gcps2003,
  properties: ['landcover'],
  scale: 30,
  tileScale: 15
}).filter(ee.Filter.notNull(bandNames.concat(['landcover'])));

var result20142023 = classifyAndGetConfusionMatrix(composite20142023, training2023, '2014-2023');
var cm20142023 = result20142023.confusionMatrix;

// Plot Confusion Matrices as Tables
var cmChart19942003 = ui.Chart.array.values({
  array: cm19942003.array(),
  axis: 0,
  xLabels: ['Urban', 'Bare', 'Water', 'Vegetation']
})
.setChartType('Table')
.setOptions({
  title: 'Confusion Matrix (1994-2003)',
  hAxis: {title: 'Predicted'},
  vAxis: {title: 'Actual'}
});
print(cmChart19942003);

var cmChart20042013 = ui.Chart.array.values({
  array: cm20042013.array(),
  axis: 0,
  xLabels: ['Urban', 'Bare', 'Water', 'Vegetation']
})
.setChartType('Table')
.setOptions({
  title: 'Confusion Matrix (2004-2013)',
  hAxis: {title: 'Predicted'},
  vAxis: {title: 'Actual'}
});
print(cmChart20042013);

var cmChart20142023 = ui.Chart.array.values({
  array: cm20142023.array(),
  axis: 0,
  xLabels: ['Urban', 'Bare', 'Water', 'Vegetation']
})
.setChartType('Table')
.setOptions({
  title: 'Confusion Matrix (2014-2023)',
  hAxis: {title: 'Predicted'},
  vAxis: {title: 'Actual'}
});
print(cmChart20142023);

// Export Confusion Matrices to Drive (optional, for external plotting)
Export.table.toDrive({
  collection: ee.FeatureCollection([
    ee.Feature(null, {matrix: cm19942003.array(), period: '1994-2003'}),
    ee.Feature(null, {matrix: cm20042013.array(), period: '2004-2013'}),
    ee.Feature(null, {matrix: cm20142023.array(), period: '2014-2023'})
  ]),
  description: 'Confusion_Matrices_1994_2023',
  folder: 'jubaPrediction/Predictions',
  fileFormat: 'CSV'
});

// Print accuracy metrics for reference
print('1994-2003 Overall Accuracy:', cm19942003.accuracy().format('%.2f'));
print('2004-2013 Overall Accuracy:', cm20042013.accuracy().format('%.2f'));
print('2014-2023 Overall Accuracy:', cm20142023.accuracy().format('%.2f'));
