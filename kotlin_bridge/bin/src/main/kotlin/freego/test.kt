package freego

fun getGreeting(): String {
    val words = mutableListOf<String>()
    words.add("Hello,")
    words.add("world!")

    return words.joinToString(separator = " ")
}
class A() : MyClass(){
    override fun do_thing() {
        super.do_thing()
        println("in kotlin do_thing()")
    }
}
fun main(args: Array<String>) {
    println( getGreeting() + MyClass.my_func() )
    val ret = WXPayWrapper.do_micropay()
    println(ret)
    // val mc = MyClass();
    // mc.do_thing();
    // val a = A()
    // a.do_thing();
}
