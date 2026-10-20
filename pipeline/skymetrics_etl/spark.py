"""SparkSession factory tuned for a laptop: small shuffles, no UI, quiet logs."""

from __future__ import annotations

from pyspark.sql import SparkSession


def build_spark(master: str = "local[4]", driver_memory: str = "2g") -> SparkSession:
    spark = (
        SparkSession.builder.appName("skymetrics-etl")
        .master(master)
        .config("spark.driver.memory", driver_memory)
        .config("spark.sql.shuffle.partitions", "8")
        .config("spark.ui.enabled", "false")
        .config("spark.ui.showConsoleProgress", "false")
        .config("spark.sql.session.timeZone", "UTC")
        # Always read local files, even if a Hadoop config on the machine points at HDFS.
        .config("spark.hadoop.fs.defaultFS", "file:///")
        .getOrCreate()
    )
    spark.sparkContext.setLogLevel("WARN")
    return spark
