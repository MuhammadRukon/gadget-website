import Link from 'next/link';
import { JSX } from 'react';
import { Container } from '../container/container';

export function Footer(): JSX.Element {
  return (
    <footer className="bg-[#f9fafc] dark:bg-background text-xs sm:text-sm text-center md:text-left py-0 bg-main pt-5 md:pt-6 w-full">
      <Container>
        <div className="md:flex justify-between md:space-x-2 w-full [&>div>h4]:text-[11px] [&>div>h4]:md:text-sm [&>div>h4]:tracking-[4px] [&>div>h4]:uppercase [&>div>h4]:mb-7 [&>div]:mb-12">
          <div>
            <h4>Support</h4>
            <div className="flex flex-col whitespace-nowrap space-y-4">
              <p>
                <span>Phone:</span>
                <br />
                <a href="whatsapp://send?phone=+8801815780053">+01815780053</a>
              </p>
              <p>
                <span>Email:</span>
                <br />
                <a href="mailto:muhammad.rukon242@gmail.com">muhammad.rukon242@gmail.com</a>
              </p>
            </div>
          </div>
          <div className="pl-4">
            <h4>About Us</h4>
            <ul className="flex flex-wrap justify-center [&>li]:pr-5 list-disc md:list-none md:grid grid-cols-2 xl:grid-cols-3 gap-2 md:gap-5">
              {[
                // ['EMI Terms', '/'],
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
              <span>Tecnologia Ltd</span>
              <br />
              Head Office: Tali Office Road, Hazaribagh, Dhaka-1209
            </p>
            <p>
              <span>Email:</span>
              <br />
              <a
                className="text-primary hover:text-primary hover:underline"
                href="mailto:muhammad.rukon242@gmail.com"
              >
                muhammad.rukon242@gmail.com
              </a>
            </p>
          </div>
        </div>
      </Container>

      <hr />

      <p className="text-xs sm:text-sm text-center py-2 sm:py-3">
        © 2025 Tecnologia Ltd | All rights reserved.
      </p>
    </footer>
  );
}
