# Named Entity Recognition (NER) and Temperature Time Series Prediction

This repository contains two projects:
1. **Named Entity Recognition (NER) using CRF and Random Forest** - Implements NER using Conditional Random Fields (CRF) and Random Forest models on the CoNLL-2003 dataset.
2. **Temperature Time Series Prediction** - Forecasts temperature data using Holt-Winters and ARIMA models.

## 1. Named Entity Recognition (NER) with CRF and Random Forest
This project applies Named Entity Recognition (NER) using two machine learning approaches: CRF and Random Forest. The models classify tokens into predefined NER categories such as "B-PER", "I-LOC", and "O" using the CoNLL-2003 dataset.

### Dataset
- **Source:** CoNLL-2003 dataset from Hugging Face (`datasets.load_dataset("conll2003")`).
- **Entities:** Person, Location, Organization, and Miscellaneous.
- **Data Handling:**
  - CRF loads the dataset into memory.
  - Random Forest uses streaming for efficiency.

### Common Dependencies
- `matplotlib`, `seaborn`: For visualization.
- `numpy`, `datasets`, `sklearn.metrics`: For computations and dataset handling.
- `collections.Counter`, `os`: For feature extraction and file handling.

### CRF Model
- **Uses** `sklearn_crfsuite.CRF` for sequence labeling.
- **Feature Extraction:** Context-based features (lowercase form, suffixes, case patterns, digit presence).
- **Training:** L-BFGS optimization, L1/L2 regularization (`c1=0.1`, `c2=0.1`), 100 iterations.
- **Evaluation:** Precision-Recall curves, confusion matrices, transition feature visualization.

### Random Forest Model
- **Uses** `sklearn.ensemble.RandomForestClassifier` for classification.
- **Feature Extraction:** Token-based features processed in chunks.
- **Training:** 100 trees, balanced class weights, max depth=30 (`n_jobs=-1`).
- **Evaluation:** Feature importance ranking, confusion matrices.

### Model Comparison
| Aspect | CRF Model | Random Forest Model |
|--------|-----------|---------------------|
| **Model Type** | Sequence labeling (CRF) | Token-level classifier (RF) |
| **Data Handling** | Entire dataset in memory | Streaming for efficiency |
| **Feature Use** | Context-aware features | Token-specific features |
| **Visualization** | Transition weights | Feature importance ranking |

### Conclusion
- **CRF:** Best for structured sequence prediction.
- **Random Forest:** Effective for feature-based classification.

## 2. Temperature Time Series Prediction
This project forecasts temperature trends using Holt-Winters and ARIMA models with a dataset spanning from 1920 to 2025.

### Features
- Preprocessing: Outlier removal with rolling mean and exponential smoothing.
- Models: Holt-Winters (additive trend and seasonal model), ARIMA (1,1,1 order).
- Metrics: RMSE, R², Kling-Gupta Efficiency (KGE).
- Visualization: Observed vs. predicted values.

### Dependencies
Install necessary packages before running the script:
```bash
pip install pandas numpy matplotlib seaborn statsmodels scikit-learn
```

### Usage
1. **Load Data:** Ensure the dataset (`data.csv`) has `Year` and `Smooth_5yr` columns.
2. **Run the Script:** Train models and generate predictions.
3. **Check Output:** Results saved in `output_plots/`.

### Data Preprocessing
- **Splits:**
  - Training: 1920-2012
  - Validation: 2013-2022
  - Testing: 2023-2025

### Model Training & Evaluation
- **Holt-Winters:** Captures seasonal trends.
- **ARIMA:** Statistical time series forecasting.
- **Evaluation Metrics:** RMSE, R², KGE.

### Results & Visualization
- Metrics stored in `evaluation_results.xlsx`.
- Plots saved in `output_plots/`, including:
  - **Time Series Plot:** `timeseries_1920_2022.png`
  - **Training vs. Observed vs. Prediction:** `training_vs_observed_vs_prediction.png`
  - **Actual vs. Predicted:** `actual_vs_predicted.png`

## License
This repository is open-source under the MIT License.

For any questions or contributions, feel free to open an issue or submit a pull request!

*Implemented and Developed by Nyombe, Deng, Alier, Anthony (5th Year Students, School of Computer Science and Information Technology - The University of Juba) and Manzu Gerald Ph.D (Lecturer, University of Juba - School of Computer Science and information Technology)*

