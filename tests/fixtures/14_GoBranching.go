package main

import "fmt"

func main() {
    var a, b int
    fmt.Scan(&a, &b)

    var max int
    if a > b {
        max = a
    } else {
        max = b
    }

    sum := 0
    for i := 1; i <= 10; i++ {
        sum += i
    }

    fmt.Println(max)
    fmt.Println(sum)
}
