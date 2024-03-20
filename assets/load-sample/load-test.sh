#!/bin/sh

# Please set a demo app URL which you can get CDK Output.
URL="http://xxxxx.xxxxx.elb.amazonaws.com/"

test(){
  # $1 : requests (-n)
  # $2 : concurrency (-c)
  echo "**********************"
  echo "ab -n ${1} -c ${2} -r ${URL}"
  date "+%Y-%m-%d %H:%M:%S"
  echo "**********************"
  ab -n ${1} -c ${2} -r ${URL}
}

test  2500  2
test  5000  4
test  6250  6
test 10000  8
test 15000 10
test 20000 12

test 25000 14

test 25000 12
test 25000 10
test 10000  8
test  6250  6
test  5000  4
test  2500  2
