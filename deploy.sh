# build images
docker build -t agiz/rippr-server:latest -t agiz/rippr-server:$SHA -f ./server/Dockerfile ./server

# push to docker hub
docker push agiz/rippr-server:latest
docker push agiz/rippr-server:$SHA

# k8s
kubectl apply -f k8s
kubectl set image deployments/server-deployment server=agiz/rippr-server:$SHA
