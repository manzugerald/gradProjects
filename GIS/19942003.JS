// Define the study area (ROI)
var juba = table.filter(ee.Filter.inList('ADM3_EN', 
    ['Juba Town', 'Kator', 'Gondokoro', 'Northern Bari', 'Munuki', 'Rejaf']));
var geometry = juba.geometry(); // Geometry explicitly defined and kept// Load Landsat 5 dataset for 1994-2004

//1994 - 2003
var dataset19942003 = ee.ImageCollection('LANDSAT/LT05/C02/T1_L2')
    .filterDate('1994-01-01', '2004-12-31') // Date range as requested
    .filterBounds(geometry); // Filter to ROI// Function to apply scaling factors
    
// Print the number of images in the dataset
print('Number of Landsat 5 images (1994-2004):', dataset19942003.size());

function applyScaleFactors(image) {
  var opticalBands = image.select(['SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B7'])
                         .multiply(0.0000275).add(-0.2);
  var thermalBand = image.select('ST_B6').multiply(0.00341802).add(149.0);
  return image.addBands(opticalBands, null, true)
              .addBands(thermalBand, null, true);
}

// Apply scaling factors
var scaledDataset19942003 = dataset19942003.map(applyScaleFactors);// Cloud mask function
function maskClouds(image) {
  var cloudMask = image.select('QA_PIXEL').bitwiseAnd(1 << 3).eq(0); // Clouds
  var shadowMask = image.select('QA_PIXEL').bitwiseAnd(1 << 4).eq(0); // Cloud shadow
  return image.updateMask(cloudMask).updateMask(shadowMask);
}// Apply cloud mask
var maskedDataset19942003 = scaledDataset19942003.map(maskClouds);// Compute the median composite and clip to ROI using geometry
var composite19942003 = maskedDataset19942003.median().clip(geometry);// Visualization parameters for True Color
var visualization19942003 = {
  bands: ['SR_B3', 'SR_B2', 'SR_B1'], // True Color (RGB)
  min: 0.0,
  max: 0.3,
};// Add composite to the map
Map.addLayer(composite19942003, visualization19942003, 'Collection (1994-2004)');

//Merge Training samples
var gcps = urban19942003.merge(bare19942003).merge(water19942003).merge(vegetation19942003);print(gcps)// Overlay the point on the image to get training data.
//Extract the pixel values
var training19942003 = composite19942003.sampleRegions({
  collection: gcps, 
  properties: ['landcover'], 
  scale: 10
});// Train a classifier.
var classifier19942003 = ee.Classifier.smileRandomForest(50).train({
  features: training19942003,
  classProperty: 'landcover', 
  inputProperties: composite19942003.bandNames()
});
// // Classify the image.
var classified19942003 = composite19942003.classify(classifier19942003);
// Choose a 4-color palette
// Assign a color for each class in the following order
// Urban, Bare, Water, Vegetation
var palette = ['#FF4500', '#DAA520', '#1E90FF', '#228B22' ];Map.addLayer(classified19942003.clip(geometry), {min: 0, max: 3, palette: palette}, '1994 - 2003');
// Display the GCPs
// We use the style() function to style the GCPs
var palette = ee.List(palette);
var landcover19942003 = ee.List([0, 1, 2, 3]);var gcpsStyled = ee.FeatureCollection(
  landcover19942003.map(function(lc){
    var color = palette.get(landcover19942003.indexOf(lc));
    var markerStyle = { color: 'white', pointShape: 'diamond', 
      pointSize: 4, width: 1, fillColor: color};
    return gcps.filter(ee.Filter.eq('landcover', lc))
                .map(function(point){
                  return point.set('style', markerStyle)
                })
      })).flatten();Map.addLayer(gcpsStyled.style({styleProperty:"style"}), {}, 'GCPs')
Map.centerObject(gcpsStyled)

