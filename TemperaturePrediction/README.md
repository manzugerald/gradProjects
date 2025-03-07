# Temperature Time Series Prediction

This project implements time series forecasting for temperature data using Holt-Winters and ARIMA models. The dataset spans from 1920 to 2025, with training, validation, and testing splits.

## Features
- Data preprocessing and outlier handling
- Time series forecasting using Holt-Winters and ARIMA
- Performance evaluation with RMSE, R², and Kling-Gupta Efficiency (KGE)
- Visualization of observed vs. predicted values

## Requirements
Install the necessary Python packages before running the script:
```bash
pip install pandas numpy matplotlib seaborn statsmodels scikit-learn
```

## Usage
1. **Load Data:** Ensure the dataset (`data.csv`) contains `Year` and `Smooth_5yr` columns.
2. **Run the script:** Execute the Python script to train models and generate predictions.
3. **Check Output:** Results are saved in the `output_plots` directory.

## Data Preprocessing
- Outlier removal using rolling mean and exponential smoothing.
- Splitting data into training (1920-2012), validation (2013-2022), and testing (2023-2025).

## Model Training & Evaluation
- **Holt-Winters:** Additive trend and seasonal model.
- **ARIMA:** Autoregressive Integrated Moving Average with (1,1,1) order.
- Metrics computed: RMSE, R², KGE.

## Results
Evaluation metrics are saved in `evaluation_results.xlsx`. Key performance indicators are printed in the console.

## Visualization
The script generates and saves the following plots:
- **Time Series Plot** (`timeseries_1920_2022.png`)
- **Training vs. Observed vs. Prediction** (`training_vs_observed_vs_prediction.png`)
- **Actual vs. Predicted** (`actual_vs_predicted.png`)

## License
This project is open-source and available under the MIT License.

---

For questions or contributions, feel free to open an issue or submit a pull request!


*Implemented and Developed by Deng, Alier (5th Year Students, School of Computer Science and Information Technology - The University of Juba) and Manzu Gerald Ph.D (Lecturer, University of Juba - School of Computer Science and information Technology)*