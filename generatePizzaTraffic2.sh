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
# Generic loop runner
########################################

run_loop() {
  name=$1
  delay=$2
  cmd=$3

  while true; do
    result=$(execute_curl "$cmd")
    echo "$name -> $result"
    sleep "$delay"
  done
}


########################################
# MENU requests (GET)
########################################

run_loop "menu" 3 "$host/api/order/menu" &
pids+=($!)


########################################
# BAD LOGIN (auth failure)
########################################

run_loop "bad_login" 7 \
"-X PUT $host/api/auth \
-d '{\"email\":\"bad\",\"password\":\"bad\"}' \
-H 'Content-Type: application/json'" &
pids+=($!)


########################################
# REGISTER USERS (POST)
########################################

while true; do
  ts=$(date +%s%N)

  execute_curl "-X POST $host/api/auth \
  -d '{\"name\":\"u$ts\",\"email\":\"u$ts@test.com\",\"password\":\"x\"}' \
  -H 'Content-Type: application/json'"

  sleep 20
done &
pids+=($!)


########################################
# GOOD LOGIN (active users + auth success)
########################################

while true; do
  login "d@jwt.com" "diner" > /dev/null
  login "f@jwt.com" "franchisee" > /dev/null
  login "a@jwt.com" "admin" > /dev/null
  sleep 15
done &
pids+=($!)


########################################
# DINER ORDER (pizza sold + revenue + latency)
########################################

while true; do

  token=$(login "d@jwt.com" "diner")

  execute_curl "-X POST $host/api/order \
  -H 'Content-Type: application/json' \
  -d '{\"franchiseId\":1,\"storeId\":1,
       \"items\":[{\"menuId\":1,\"description\":\"Veggie\",\"price\":0.05}]}' \
  -H \"Authorization: Bearer $token\""

  logout "$token"

  sleep 5

done &
pids+=($!)


########################################
# FAILED ORDER (pizza_creation_failures)
########################################

while true; do

  token=$(login "d@jwt.com" "diner")

  execute_curl "-X POST $host/api/order \
  -H 'Content-Type: application/json' \
  -d '{\"franchiseId\":1,\"storeId\":1,\"items\":[]}' \
  -H \"Authorization: Bearer $token\""

  logout "$token"

  sleep 25

done &
pids+=($!)


########################################
# MANY PIZZAS (large request failure)
########################################

while true; do

  token=$(login "d@jwt.com" "diner")

  items='{ "menuId":1,"description":"Veggie","price":0.05 }'

  for ((i=0;i<25;i++))
  do
    items+=',{"menuId":1,"description":"Veggie","price":0.05}'
  done

  execute_curl "-X POST $host/api/order \
  -H 'Content-Type: application/json' \
  -d '{\"franchiseId\":1,\"storeId\":1,\"items\":[$items]}' \
  -H \"Authorization: Bearer $token\""

  logout "$token"

  sleep 60

done &
pids+=($!)


########################################
# ADMIN MENU EDIT (PUT)
########################################

while true; do

  token=$(login "a@jwt.com" "admin")

  ts=$(date +%s%N)

  execute_curl "-X PUT $host/api/order/menu \
  -H 'Content-Type: application/json' \
  -d '{\"title\":\"S$ts\",\"description\":\"promo\",\"image\":\"x\",\"price\":0.06}' \
  -H \"Authorization: Bearer $token\""

  logout "$token"

  sleep 40

done &
pids+=($!)


########################################
# PROFILE LOOKUP (GET /api/user)
########################################

while true; do

  token=$(login "d@jwt.com" "diner")

  execute_curl "-X GET $host/api/user \
  -H \"Authorization: Bearer $token\""

  logout "$token"

  sleep 15

done &
pids+=($!)


########################################
# FRANCHISE LOOKUP (GET /api/franchise)
########################################

while true; do

  token=$(login "f@jwt.com" "franchisee")

  execute_curl "-X GET $host/api/franchise \
  -H \"Authorization: Bearer $token\""

  logout "$token"

  sleep 18

done &
pids+=($!)


########################################
# RANDOM METHOD TESTS (ensure all methods tracked)
########################################

while true; do

  execute_curl "$host/api/order/menu"
  execute_curl "-X DELETE $host/api/auth"
  execute_curl "-X PUT $host/api/auth -d '{}' -H 'Content-Type: application/json'"
  execute_curl "-X POST $host/api/auth -d '{}' -H 'Content-Type: application/json'"

  sleep 12

done &
pids+=($!)


########################################
# Wait forever
########################################

wait
