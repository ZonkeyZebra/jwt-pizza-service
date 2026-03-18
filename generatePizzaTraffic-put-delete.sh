#!/bin/bash

if [ -z "$1" ]; then
  echo "Usage: $0 <host>"
  exit 1
fi

host=$1
pids=()

########################################
# Cleanup
########################################

cleanup() {
  echo "Stopping simulations..."
  for pid in "${pids[@]}"; do
    kill "$pid" 2>/dev/null
  done
  exit 0
}

trap cleanup SIGINT


########################################
# Curl wrapper
########################################

execute_curl() {
  echo $(eval "curl -s -o /dev/null -w \"%{http_code}\" $1")
}


########################################
# Auth helpers
########################################

login() {
  response=$(curl -s -X PUT $host/api/auth \
    -d "{\"email\":\"$1\", \"password\":\"$2\"}" \
    -H 'Content-Type: application/json')

  echo $response | jq -r '.token'
}

logout() {
  token=$1
  execute_curl "-X DELETE $host/api/auth -H \"Authorization: Bearer $token\""
}


########################################
# PUT REQUESTS - Admin menu edits
########################################

while true; do

  token=$(login "a@jwt.com" "admin")

  ts=$(date +%s%N)

  execute_curl "-X PUT $host/api/order/menu \
  -H 'Content-Type: application/json' \
  -d '{\"title\":\"S$ts\",\"description\":\"promo\",\"image\":\"x\",\"price\":0.06}' \
  -H \"Authorization: Bearer $token\""

  logout "$token"

  sleep 2

done &
pids+=($!)


########################################
# PUT REQUESTS - Auth updates (rate limited login)
########################################

while true; do

  login "d@jwt.com" "diner" > /dev/null
  login "f@jwt.com" "franchisee" > /dev/null
  login "a@jwt.com" "admin" > /dev/null

  sleep 5

done &
pids+=($!)


########################################
# DELETE REQUESTS - Logout operations
########################################

while true; do

  token=$(login "d@jwt.com" "diner")
  execute_curl "-X DELETE $host/api/auth -H \"Authorization: Bearer $token\""

  token=$(login "f@jwt.com" "franchisee")
  execute_curl "-X DELETE $host/api/auth -H \"Authorization: Bearer $token\""

  token=$(login "a@jwt.com" "admin")
  execute_curl "-X DELETE $host/api/auth -H \"Authorization: Bearer $token\""

  sleep 8

done &
pids+=($!)


########################################
# POST REQUESTS - User registration
########################################

while true; do

  ts=$(date +%s%N)

  execute_curl "-X POST $host/api/auth \
  -d '{\"name\":\"u$ts\",\"email\":\"u$ts@test.com\",\"password\":\"x\"}' \
  -H 'Content-Type: application/json'"

  sleep 15

done &
pids+=($!)


########################################
# POST REQUESTS - Order creation
########################################

while true; do

  token=$(login "d@jwt.com" "diner")

  execute_curl "-X POST $host/api/order \
  -H 'Content-Type: application/json' \
  -d '{\"franchiseId\":1,\"storeId\":1,
       \"items\":[{\"menuId\":1,\"description\":\"Veggie\",\"price\":0.05}]}' \
  -H \"Authorization: Bearer $token\""

  logout "$token"

  sleep 8

done &
pids+=($!)


########################################
# INTENSIVE PUT/DELETE/POST - Rapid fire requests
########################################

while true; do

  for ((i=0;i<3;i++)); do
    execute_curl "-X PUT $host/api/auth -d '{}' -H 'Content-Type: application/json'"
    execute_curl "-X DELETE $host/api/auth"
    execute_curl "-X POST $host/api/auth -d '{}' -H 'Content-Type: application/json'"
  done

  sleep 10

done &
pids+=($!)


########################################
# Wait forever
########################################

wait
