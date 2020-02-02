TODO...

Allow GKE to connect to GCE via internal network.
`gcloud compute firewall-rules create allow-elastic-from-gke --priority=2000 --source-ranges=10.16.0.0/14 --target-tags=elastic --allow=tcp:9200 --direction=INGRESS --network=default`
