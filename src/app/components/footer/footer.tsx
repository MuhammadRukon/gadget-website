import Link from 'next/link';
import { JSX } from 'react';

export function Footer(): JSX.Element {
  return (
    <footer className="text-xs sm:text-sm text-center md:text-left py-0 bg-main text-dim mt-20 pt-5 md:pt-6 xl:pt-[50px] w-full">
      <div className="md:flex justify-between md:space-x-2 w-full [&>div>h4]:text-[11px] [&>div>h4]:md:text-sm [&>div>h4]:tracking-[4px] [&>div>h4]:text-white [&>div>h4]:uppercase [&>div>h4]:mb-7 [&>div]:mb-12 px-4">
        <div>
          <h4>Support</h4>
          <div className="flex flex-col items-center whitespace-nowrap space-y-4"></div>
        </div>
        <div className="pl-4">
          <h4>About Us</h4>
          <ul className="flex flex-wrap justify-center [&>li]:pr-5 list-disc md:list-none md:grid grid-cols-2 xl:grid-cols-3 gap-2 md:gap-5">
            {[
              ['EMI Terms', '/'],
              ['About Us', '/'],
              ['Online Delivery', '/'],
              ['Privacy Policy', '/'],
              ['Terms and Conditions', '/'],
              ['Refund and Return Policy', '/'],
              ['Blog', '/'],
              ['Contact Us', '/'],
              ['Brands', '/'],
              ['Online Service Support', '/', 1],
              ['Complain / Advice', '/', 1],
            ].map(([label, link, active = 0], index) => (
              <li key={index}>
                <Link
                  className={`hover:text-primary hover:underline ${active && 'text-primary'}`}
                  href={link as string}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="md:max-w-xs [&>p]:leading-7">
          <h4>Stay Connected</h4>
          <p>
            <p>Star Gadget Ltd</p>
            <br />
            Head Office: 27 Kazi Nazrul Islam Ave,Navana Zohura Square, Dhaka 1000
          </p>
          <p>
            <span>Email:</span>
            <br />
            <a
              className="text-primary hover:text-primary hover:underline"
              href="mailto:shahariarrahman98@gmail.com"
            >
              webteam@stargadgetbd.com
            </a>
          </p>
        </div>
      </div>

      <hr />

      <p className="text-xs sm:text-sm text-center py-2 sm:py-3">
        © {new Date().getFullYear()} Tecnologia Ltd | All rights reserved.
      </p>
    </footer>
  );
}
